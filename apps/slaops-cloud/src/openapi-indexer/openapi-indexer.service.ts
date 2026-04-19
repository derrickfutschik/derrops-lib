import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Client } from '@opensearch-project/opensearch'
import { IndexingError, IndexingErrorCode } from '@slaops/cloud/openapi-search/types/openapi-index.types'
import { config } from '@slaops/config'
import { Search, TypescriptOSProxyClient } from 'opensearch-ts'
import { v4 as uuid } from 'uuid'
import { OpenApiParserService } from './openapi-parser.service'
import { oaspecId } from './oaspec-id'
import {
  CatalogueHit,
  OaModelDocument,
  OaOperationDocument,
  OaParamDocument,
  OaServerDocument,
  OaSpecDocument,
} from './oaspec-documents'
import { ApiService } from '../api/api.service'
import { OpenSearchService } from '../opensearch/opensearch.service'

/**
 * Build an S3Client that works for both local (MinIO) and cloud environments.
 *
 * When a local (non-AWS) endpoint is configured the credential-provider chain is
 * bypassed by supplying credentials explicitly (MinIO default or whatever the
 * environment has). This avoids dynamic-import errors in Jest when
 * --experimental-vm-modules is absent.
 */
export function buildS3Client(): S3Client {
  const endpoint = config['aws.s3.endpoint']
  const isLocalEndpoint = endpoint && !endpoint.includes('amazonaws.com')
  if (isLocalEndpoint) {
    return new S3Client({
      region: config['aws.s3.region'],
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'minioadmin',
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'minioadmin',
      },
    })
  }
  return new S3Client({ region: config['aws.s3.region'] })
}

export interface PresignedUrlResult {
  url: string
  key: string
  bucket: string
  expiresIn: number
}

export interface IndexingResponse {
  success: boolean
  apiId: string
  version: string
  specOpensearchId: string
  durationMs: number
  counts: {
    operations: number
    servers: number
    parameters: number
    models: number
  }
  truncated: {
    operations: boolean
    models: boolean
  }
  versionsPruned: number
  errors: Array<{
    step: 'spec' | 'server' | 'operation' | 'param' | 'model' | 'sql'
    message: string
  }>
}

const PRESIGNED_URL_EXPIRES_IN = 3600 // 1 hour
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const
const METHOD_INITIAL: Record<string, string> = {
  GET: 'G',
  POST: 'P',
  PUT: 'U',
  DELETE: 'D',
  PATCH: 'A',
  HEAD: 'H',
  OPTIONS: 'O',
}

function oaspecIndex(tenantId: string, entity: string): string {
  const prefix = config['opensearch.prefix']
  const env = config['opensearch.suffix']
  return `${prefix}--${env}--${tenantId}--oaspec--${entity}`
}

function compactPath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (!seg.startsWith('{')) return seg
      // heuristic: treat as integer param
      return '{i}'
    })
    .join('/')
}

function deriveHostShape(serverUrl: string): {
  scheme: string
  hostTemplate: string
  hostShape: string
  dnsSuffix: string
  fixedLabelsText: string
  varLabelsText: string
  basePath: string
} {
  let parsed: URL
  try {
    parsed = new URL(serverUrl.replace(/\{[^}]+\}/g, 'placeholder'))
  } catch {
    return {
      scheme: 'https',
      hostTemplate: serverUrl,
      hostShape: serverUrl,
      dnsSuffix: '',
      fixedLabelsText: '',
      varLabelsText: '',
      basePath: '/',
    }
  }

  const scheme = parsed.protocol.replace(':', '')
  const basePath = parsed.pathname || '/'

  // Restore {var} placeholders for hostTemplate
  const hostTemplate = serverUrl.includes('://')
    ? serverUrl.split('://')[1]?.split('/')[0] ?? parsed.hostname
    : parsed.hostname

  const varPattern = /\{([^}]+)\}/g
  const varLabels: string[] = []
  let m: RegExpExecArray | null
  const tmpl = hostTemplate
  while ((m = varPattern.exec(tmpl)) !== null) {
    varLabels.push(m[1]!)
  }

  const hostShape = hostTemplate.replace(/\{[^}]+\}/g, '*')

  const labels = hostShape.split('.')
  const dnsSuffix =
    labels.length >= 2 ? labels.slice(-2).join('.') : hostShape

  const fixedLabels = hostShape.split('.').filter((l) => l !== '*' && l !== '')

  return {
    scheme,
    hostTemplate,
    hostShape,
    dnsSuffix,
    fixedLabelsText: fixedLabels.join(' '),
    varLabelsText: varLabels.join(' '),
    basePath,
  }
}

@Injectable()
export class OpenApiIndexerService implements OnModuleInit {
  private readonly logger = new Logger(OpenApiIndexerService.name)
  private s3Client!: S3Client

  constructor(
    private readonly parserService: OpenApiParserService,
    private readonly opensearchClient: Client,
    private readonly tsClient: TypescriptOSProxyClient,
    private readonly apiService: ApiService,
    private readonly openSearchService: OpenSearchService,
  ) {}

  async onModuleInit() {
    this.s3Client = buildS3Client()
  }

  // ---------------------------------------------------------------------------
  // Pre-signed upload URL — points at the permanent OASpec storage bucket
  // ---------------------------------------------------------------------------

  async generatePresignedUploadUrl(apiId: string, key: string): Promise<PresignedUrlResult> {
    const bucket = config['slaops.oaspec.storage.bucket']
    const objectKey = key || `${uuid()}/openapi.yaml`
    const command = new PutObjectCommand({ Bucket: bucket, Key: objectKey })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = await getSignedUrl(this.s3Client as any, command, {
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
    })
    return { url, key: objectKey, bucket, expiresIn: PRESIGNED_URL_EXPIRES_IN }
  }

  // ---------------------------------------------------------------------------
  // 6-step indexing pipeline
  // ---------------------------------------------------------------------------

  async indexSpec(
    apiId: string,
    tenantId: string,
    bucket: string,
    key: string,
  ): Promise<IndexingResponse> {
    const startTime = Date.now()
    const errors: IndexingResponse['errors'] = []
    let specOpensearchId = ''
    let version = ''
    let versionsPruned = 0

    const counts = { operations: 0, servers: 0, parameters: 0, models: 0 }
    const truncated = { operations: false, models: false }

    // ── Verify api row belongs to this tenant ─────────────────────────────────
    try {
      await this.apiService.findOne(apiId, tenantId)
    } catch (err: any) {
      return {
        success: false,
        apiId,
        version: '',
        specOpensearchId: '',
        durationMs: Date.now() - startTime,
        counts,
        truncated,
        versionsPruned: 0,
        errors: [{ step: 'spec', message: `API row not found: ${err.message}` }],
      }
    }

    // ── Parse spec ────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawSpec: any
    let content: string
    try {
      content = await this.fetchS3Object(bucket, key)
      const format = key.toLowerCase().endsWith('.json') ? 'json' : 'yaml'
      const parsed = this.parserService.parseContent(content, format)
      this.parserService.validateOpenApi3(parsed, key)
      rawSpec = parsed
    } catch (err: any) {
      return {
        success: false,
        apiId,
        version: '',
        specOpensearchId: '',
        durationMs: Date.now() - startTime,
        counts,
        truncated,
        versionsPruned: 0,
        errors: [{ step: 'spec', message: `Parse error: ${err.message}` }],
      }
    }

    version = rawSpec.info.version ?? 'unknown'
    const title = rawSpec.info.title ?? ''
    const now = new Date().toISOString()
    const format = key.toLowerCase().endsWith('.json') ? 'json' : 'yaml'
    const fileSize = Buffer.byteLength(content!, 'utf8')

    // Lazy alias provisioning (ensures private indices exist for this tenant)
    try {
      await this.openSearchService.addPrivateIndicesToAliases(tenantId)
    } catch (err: any) {
      this.logger.warn(`Alias provisioning warning for tenant ${tenantId}: ${err.message}`)
    }

    // ── Step 1: Spec document ─────────────────────────────────────────────────
    specOpensearchId = oaspecId(tenantId, title, version)
    try {
      await this._setLatestFalse(tenantId, 'spec', apiId)

      const tagsText = (rawSpec.tags?.map((t: { name: string }) => t.name) ?? []).join(' ')

      const contactText = rawSpec.info.contact
        ? [rawSpec.info.contact.name, rawSpec.info.contact.email, rawSpec.info.contact.url]
            .filter(Boolean)
            .join(' ')
        : undefined

      const licenseText = rawSpec.info.license
        ? [rawSpec.info.license.name, rawSpec.info.license.url].filter(Boolean).join(' ')
        : undefined

      const specDoc: OaSpecDocument = {
        id: specOpensearchId,
        apiId,
        tenantId,
        version,
        specVersion: rawSpec.openapi,
        latest: true,
        indexedAt: now,
        updatedAt: now,
        title,
        description: rawSpec.info.description ?? '',
        termsOfService: rawSpec.info.termsOfService,
        contactText,
        licenseText,
        externalDocsText: rawSpec.externalDocs
          ? [rawSpec.externalDocs.description, rawSpec.externalDocs.url]
              .filter(Boolean)
              .join(' ')
          : undefined,
        tagsText,
        operationCount: 0,
        serverCount: 0,
        parameterCount: 0,
        modelCount: 0,
        s3Bucket: bucket,
        s3Key: key,
        fileSize,
        fileFormat: format,
      }

      await this.opensearchClient.index({
        index: oaspecIndex(tenantId, 'spec'),
        id: specOpensearchId,
        body: specDoc,
        refresh: true,
      })
    } catch (err: any) {
      errors.push({ step: 'spec', message: err.message })
    }

    // ── Step 2: Server documents ──────────────────────────────────────────────
    const servers: Array<{ url?: string; description?: string; variables?: Record<string, { default?: string }> }> =
      rawSpec.servers ?? []
    try {
      await this._setLatestFalse(tenantId, 'server', apiId)

      const serverDocs: OaServerDocument[] = servers.map((server, idx) => {
        const fields = deriveHostShape(server.url ?? '')
        const serverId = oaspecId(tenantId, title, version, server.url ?? String(idx))
        return {
          id: serverId,
          apiId,
          specId: specOpensearchId,
          tenantId,
          version,
          serverIndex: idx,
          latest: true,
          indexedAt: now,
          rawUrl: server.url ?? '',
          description: server.description,
          variablesText: server.variables
            ? Object.entries(server.variables)
                .map(([k, v]) => `${k}:${v?.default ?? ''}`)
                .join(' ')
            : undefined,
          ...fields,
        }
      })

      if (serverDocs.length > 0) {
        await this.opensearchClient.bulk({
          body: serverDocs.flatMap((doc) => [
            { index: { _index: oaspecIndex(tenantId, 'server'), _id: doc.id } },
            doc,
          ]),
          refresh: true,
        })
      }

      counts.servers = serverDocs.length
    } catch (err: any) {
      errors.push({ step: 'server', message: err.message })
    }

    // ── Step 3: Operation documents ───────────────────────────────────────────
    const operations: OaOperationDocument[] = []
    try {
      await this._setLatestFalse(tenantId, 'operation', apiId)

      const paths: Record<string, Record<string, { operationId?: string; summary?: string; description?: string; tags?: string[]; deprecated?: boolean; parameters?: unknown[] }>> =
        rawSpec.paths ?? {}
      for (const [path, pathItem] of Object.entries(paths)) {
        for (const method of HTTP_METHODS) {
          const op = pathItem[method]
          if (!op) continue

          const methodUpper = method.toUpperCase()
          const initial = METHOD_INITIAL[methodUpper] ?? methodUpper[0]!
          const pathKey = `${initial}:${compactPath(path)}`
          const opId = oaspecId(tenantId, title, version, methodUpper, path)

          operations.push({
            id: opId,
            apiId,
            specId: specOpensearchId,
            tenantId,
            version,
            latest: true,
            indexedAt: now,
            method: methodUpper,
            path,
            operationId: op.operationId,
            summary: op.summary,
            description: op.description,
            tagsText: (op.tags ?? []).join(' '),
            deprecated: op.deprecated ?? false,
            pathKey,
            parameterIdsText: '',
            requestModelId: undefined,
            responseModelIdsText: '',
          })
        }
      }

      if (operations.length > config['app.pagination.default.size'] * 50) {
        truncated.operations = true
      }

      if (operations.length > 0) {
        await this.opensearchClient.bulk({
          body: operations.flatMap((doc) => [
            { index: { _index: oaspecIndex(tenantId, 'operation'), _id: doc.id } },
            doc,
          ]),
          refresh: true,
        })
      }

      counts.operations = operations.length
    } catch (err: any) {
      errors.push({ step: 'operation', message: err.message })
    }

    // ── Step 4: Parameter documents ───────────────────────────────────────────
    try {
      await this._setLatestFalse(tenantId, 'param', apiId)

      type RawParam = {
        name?: string
        in?: string
        required?: boolean
        deprecated?: boolean
        description?: string
        schema?: { type?: string; format?: string }
        example?: unknown
      }

      const paramMap = new Map<string, { doc: Omit<OaParamDocument, 'operationIdsText'>; operationIds: Set<string> }>()

      const allPaths: Record<string, Record<string, { parameters?: RawParam[] }>> = rawSpec.paths ?? {}

      // Shared components.parameters
      for (const [name, param] of Object.entries<RawParam>(rawSpec.components?.parameters ?? {})) {
        const paramId = oaspecId(tenantId, title, version, name, param.in ?? 'query')
        if (!paramMap.has(paramId)) {
          paramMap.set(paramId, {
            doc: {
              id: paramId,
              apiId,
              specId: specOpensearchId,
              tenantId,
              version,
              latest: true,
              indexedAt: now,
              name: param.name ?? name,
              location: param.in ?? 'query',
              required: param.required ?? false,
              deprecated: param.deprecated ?? false,
              description: param.description,
              schemaType: param.schema?.type,
              schemaFormat: param.schema?.format,
              exampleText: param.example != null ? JSON.stringify(param.example) : undefined,
            },
            operationIds: new Set(),
          })
        }
      }

      // Per-operation parameters
      for (const [path, pathItem] of Object.entries(allPaths)) {
        for (const method of HTTP_METHODS) {
          const op = pathItem[method]
          if (!op?.parameters) continue
          const opId = oaspecId(tenantId, title, version, method.toUpperCase(), path)
          for (const param of op.parameters) {
            const name = param.name ?? ''
            const location = param.in ?? 'query'
            const paramId = oaspecId(tenantId, title, version, name, location)
            if (!paramMap.has(paramId)) {
              paramMap.set(paramId, {
                doc: {
                  id: paramId,
                  apiId,
                  specId: specOpensearchId,
                  tenantId,
                  version,
                  latest: true,
                  indexedAt: now,
                  name,
                  location,
                  required: param.required ?? false,
                  deprecated: param.deprecated ?? false,
                  description: param.description,
                  schemaType: param.schema?.type,
                  schemaFormat: param.schema?.format,
                  exampleText: param.example != null ? JSON.stringify(param.example) : undefined,
                },
                operationIds: new Set(),
              })
            }
            paramMap.get(paramId)!.operationIds.add(opId)
          }
        }
      }

      const paramDocs: OaParamDocument[] = Array.from(paramMap.values()).map(({ doc, operationIds }) => ({
        ...doc,
        operationIdsText: Array.from(operationIds).join(' '),
      }))

      if (paramDocs.length > 0) {
        await this.opensearchClient.bulk({
          body: paramDocs.flatMap((doc) => [
            { index: { _index: oaspecIndex(tenantId, 'param'), _id: doc.id } },
            doc,
          ]),
          refresh: true,
        })
      }

      counts.parameters = paramDocs.length
    } catch (err: any) {
      errors.push({ step: 'param', message: err.message })
    }

    // ── Step 5: Model documents ───────────────────────────────────────────────
    try {
      await this._setLatestFalse(tenantId, 'model', apiId)

      type RawSchema = {
        description?: string
        type?: string
        properties?: Record<string, { type?: string; format?: string; description?: string }>
      }

      const modelDocs: OaModelDocument[] = []
      const schemas: Record<string, RawSchema> = rawSpec.components?.schemas ?? {}

      for (const [modelName, schema] of Object.entries(schemas)) {
        const modelId = oaspecId(tenantId, title, version, modelName)
        const props = schema.properties ?? {}
        const propertiesText = Object.entries(props)
          .map(([propName, propSchema]) => {
            const parts = [propName, propSchema.type, propSchema.format].filter(Boolean).join(' ')
            return propSchema.description ? `${parts} - ${propSchema.description}` : parts
          })
          .join('\n')

        modelDocs.push({
          id: modelId,
          apiId,
          specId: specOpensearchId,
          tenantId,
          version,
          latest: true,
          indexedAt: now,
          name: modelName,
          description: schema.description,
          schemaType: schema.type ?? 'object',
          propertiesText,
          operationIdsText: '',
          usedInText: '',
        })
      }

      if (modelDocs.length > 500) {
        truncated.models = true
      }

      const docsToIndex = modelDocs.slice(0, 500)

      if (docsToIndex.length > 0) {
        await this.opensearchClient.bulk({
          body: docsToIndex.flatMap((doc) => [
            { index: { _index: oaspecIndex(tenantId, 'model'), _id: doc.id } },
            doc,
          ]),
          refresh: true,
        })
      }

      counts.models = modelDocs.length
    } catch (err: any) {
      errors.push({ step: 'model', message: err.message })
    }

    // ── Version pruning ───────────────────────────────────────────────────────
    try {
      versionsPruned = await this._pruneOldVersions(tenantId, apiId, version)
    } catch (err: any) {
      this.logger.warn(`Version pruning failed for ${apiId}: ${err.message}`)
    }

    // ── Step 6: Update api SQL row ────────────────────────────────────────────
    try {
      await this.apiService.updateOaSpecStats(apiId, tenantId, {
        bucket,
        key,
        latestVersion: version,
        globalOpensearchId: specOpensearchId,
        operationCount: counts.operations,
        serverCount: counts.servers,
        parameterCount: counts.parameters,
        modelCount: counts.models,
        lastIndexedAt: new Date(),
      })

      // Back-fill spec doc with final counts
      await this.opensearchClient.update({
        index: oaspecIndex(tenantId, 'spec'),
        id: specOpensearchId,
        body: {
          doc: {
            operationCount: counts.operations,
            serverCount: counts.servers,
            parameterCount: counts.parameters,
            modelCount: counts.models,
          },
        },
        refresh: true,
      })
    } catch (err: any) {
      errors.push({ step: 'sql', message: err.message })
    }

    return {
      success: errors.length === 0 || errors.every((e) => e.step !== 'spec'),
      apiId,
      version,
      specOpensearchId,
      durationMs: Date.now() - startTime,
      counts,
      truncated,
      versionsPruned,
      errors,
    }
  }

  // ---------------------------------------------------------------------------
  // Platform catalogue search (Managed Search — global tier only)
  // ---------------------------------------------------------------------------

  async searchCatalogue(
    query: string,
    limit: number,
    offset: number,
  ): Promise<{ total: number; hits: CatalogueHit[] }> {
    const globalTenantId = config['opensearch.oaspec.global-tenant-id']
    const index = oaspecIndex(globalTenantId, 'spec')

    // multi_match is a raw OpenSearch query not covered by opensearch-ts's typed query
    // builder; cast the query portion to `never` to keep the rest of the body typed.
    type CatalogueSearch = Search<OaSpecDocument, Record<string, never>>

    const rawQuery = query
      ? { multi_match: { query, fields: ['title^3', 'description', 'tagsText'] } }
      : { match_all: {} }

    const body: CatalogueSearch = {
      from: offset,
      size: limit,
      query: rawQuery as never,
    }

    const response = await this.tsClient.searchTS<OaSpecDocument, Record<string, never>>({
      body,
      index,
    })

    const hitsTotal = response.hits.total
    // TotalHits can be number | TotalHits | null depending on the OpenSearch version
    const total = hitsTotal == null
      ? 0
      : typeof hitsTotal === 'object' && hitsTotal != null
        ? (hitsTotal as { value: number }).value
        : (hitsTotal as number)

    const hits: CatalogueHit[] = response.hits.hits.map((h) => ({
      id: h._id,
      title: h._source.title,
      description: h._source.description,
      version: h._source.version,
      operationCount: h._source.operationCount,
      serverCount: h._source.serverCount,
      tagsText: h._source.tagsText,
    }))

    return { total, hits }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async fetchS3Object(bucket: string, key: string): Promise<string> {
    const response = await this.s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!response.Body) {
      throw new IndexingError(`Empty response body for ${key}`, IndexingErrorCode.S3_ERROR, key)
    }
    return response.Body.transformToString('utf-8')
  }

  /** Set latest=false on the single current-latest document for an apiId in a given index. */
  private async _setLatestFalse(
    tenantId: string,
    entity: string,
    apiId: string,
  ): Promise<void> {
    await this.opensearchClient.updateByQuery({
      index: oaspecIndex(tenantId, entity),
      body: {
        query: {
          bool: {
            filter: [{ term: { apiId } }, { term: { latest: true } }],
          },
        },
        script: { source: 'ctx._source.latest = false', lang: 'painless' },
      },
      refresh: true,
    })
  }

  /** Prune versions outside the retention window across all 5 indices. Returns count deleted. */
  private async _pruneOldVersions(
    tenantId: string,
    apiId: string,
    _currentVersion: string,
  ): Promise<number> {
    const retention = config['opensearch.oaspec.version-retention']
    const entities = ['spec', 'server', 'operation', 'param', 'model']

    // Find versions ordered by indexedAt desc from spec index
    const specIndex = oaspecIndex(tenantId, 'spec')
    const response = await this.tsClient.searchTS<OaSpecDocument, Record<string, never>>({
      body: {
        query: { term: { apiId } } as never,
        sort: [{ indexedAt: { order: 'desc' } }] as never,
        size: 100,
      },
      index: specIndex,
    })

    const allVersions: string[] = response.hits.hits.map((h) => h._source.version)
    const versionsToDelete = allVersions.slice(retention)

    if (versionsToDelete.length === 0) return 0

    let deleted = 0
    for (const entity of entities) {
      const result = await this.opensearchClient.deleteByQuery({
        index: oaspecIndex(tenantId, entity),
        body: {
          query: {
            bool: {
              filter: [{ term: { apiId } }, { terms: { version: versionsToDelete } }],
            },
          },
        },
        refresh: true,
      })
      deleted += (result.body as any).deleted ?? 0
    }

    return deleted
  }

}
