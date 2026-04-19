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
  OaSpecDocument,
} from './oaspec-documents'
import {
  ExtractionContext,
  ExtractionError,
  ExtractionState,
  ISpecExtractor,
  OaspecEntity,
} from './extractor.types'
import {
  SpecExtractor,
  ServerExtractor,
  OperationExtractor,
  ParamExtractor,
  ModelExtractor,
} from './extractors'
import { ApiService } from '../api/api.service'
import { OpenSearchService } from '../opensearch/opensearch.service'

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
  states: ExtractionState[]
}

export { ExtractionState, ExtractionError }

const PRESIGNED_URL_EXPIRES_IN = 3600

const EXTRACTORS: ISpecExtractor<unknown>[] = [
  new SpecExtractor(),
  new ServerExtractor(),
  new OperationExtractor(),
  new ParamExtractor(),
  new ModelExtractor(),
]

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
  // Pre-signed upload URL
  // ---------------------------------------------------------------------------

  async generatePresignedUploadUrl(apiId: string, key: string): Promise<PresignedUrlResult> {
    const bucket = config['slaops.oaspec.storage.bucket']
    const objectKey = key || `${uuid()}/openapi.yaml`
    const command = new PutObjectCommand({ Bucket: bucket, Key: objectKey })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = await getSignedUrl(this.s3Client as any, command, { expiresIn: PRESIGNED_URL_EXPIRES_IN })
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

    // ── Verify api row ────────────────────────────────────────────────────────
    try {
      await this.apiService.findOne(apiId, tenantId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        apiId,
        version: '',
        specOpensearchId: '',
        durationMs: Date.now() - startTime,
        states: [{ entity: 'spec', extracted: 0, indexed: 0, pruned: 0, truncated: false, errors: [{ phase: 'extract', message: `API row not found: ${msg}` }] }],
      }
    }

    // ── Parse spec ────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawSpec: Record<string, any> = {}
    let content: string
    try {
      content = await this.fetchS3Object(bucket, key)
      const format = key.toLowerCase().endsWith('.json') ? 'json' : 'yaml'
      const parsed = this.parserService.parseContent(content, format)
      this.parserService.validateOpenApi3(parsed, key)
      rawSpec = parsed as unknown as Record<string, unknown>
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        apiId,
        version: '',
        specOpensearchId: '',
        durationMs: Date.now() - startTime,
        states: [{ entity: 'spec', extracted: 0, indexed: 0, pruned: 0, truncated: false, errors: [{ phase: 'extract', message: `Parse error: ${msg}` }] }],
      }
    }

    const version = rawSpec['info']?.version ?? 'unknown'
    const title = rawSpec['info']?.title ?? ''
    const format = key.toLowerCase().endsWith('.json') ? 'json' : 'yaml'
    const fileSize = Buffer.byteLength(content!, 'utf8')
    const specId = oaspecId(tenantId, title, version)

    // ── Lazy alias provisioning ───────────────────────────────────────────────
    try {
      await this.openSearchService.addPrivateIndicesToAliases(tenantId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`Alias provisioning warning for tenant ${tenantId}: ${msg}`)
    }

    const ctx: ExtractionContext = {
      tenantId,
      apiId,
      specId,
      version,
      spec: rawSpec,
      indexedAt: new Date().toISOString(),
      s3Bucket: bucket,
      s3Key: key,
      fileSize,
      fileFormat: format,
    }

    // ── Steps 1–5: Run all extractors ─────────────────────────────────────────
    const states: ExtractionState[] = []
    for (const extractor of EXTRACTORS) {
      states.push(await this._runExtractor(extractor, ctx))
    }

    // ── Step 6: Update api SQL row + back-fill spec counts ────────────────────
    const getCounts = (entity: OaspecEntity) => states.find((s) => s.entity === entity)?.indexed ?? 0

    try {
      await this.apiService.updateOaSpecStats(apiId, tenantId, {
        bucket,
        key,
        latestVersion: version,
        globalOpensearchId: specId,
        operationCount: getCounts('operation'),
        serverCount: getCounts('server'),
        parameterCount: getCounts('param'),
        modelCount: getCounts('model'),
        lastIndexedAt: new Date(),
      })

      await this.opensearchClient.update({
        index: config['opensearch.oaspec.index'](tenantId, 'spec'),
        id: specId,
        body: {
          doc: {
            operationCount: getCounts('operation'),
            serverCount: getCounts('server'),
            parameterCount: getCounts('param'),
            modelCount: getCounts('model'),
          },
        },
        refresh: true,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const sqlState: ExtractionState = {
        entity: 'spec',
        extracted: 0,
        indexed: 0,
        pruned: 0,
        truncated: false,
        errors: [{ phase: 'index', message: `SQL update failed: ${msg}` }],
      }
      states.push(sqlState)
    }

    const hasSpecError = states.some((s) => s.entity === 'spec' && s.errors.some((e) => e.phase === 'extract'))

    return {
      success: !hasSpecError,
      apiId,
      version,
      specOpensearchId: specId,
      durationMs: Date.now() - startTime,
      states,
    }
  }

  // ---------------------------------------------------------------------------
  // Platform catalogue search
  // ---------------------------------------------------------------------------

  async searchCatalogue(
    query: string,
    limit: number,
    offset: number,
  ): Promise<{ total: number; hits: CatalogueHit[] }> {
    const globalTenantId = config['opensearch.oaspec.global-tenant-id']
    const index = config['opensearch.oaspec.index'](globalTenantId, 'spec')

    type CatalogueSearch = Search<OaSpecDocument, Record<string, never>>
    const rawQuery = query
      ? { multi_match: { query, fields: ['title^3', 'description', 'tagsText'] } }
      : { match_all: {} }

    const body: CatalogueSearch = { from: offset, size: limit, query: rawQuery as never }
    const response = await this.tsClient.searchTS<OaSpecDocument, Record<string, never>>({ body, index })

    const hitsTotal = response.hits.total
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

  private async _runExtractor(
    extractor: ISpecExtractor<unknown>,
    ctx: ExtractionContext,
  ): Promise<ExtractionState> {
    const state: ExtractionState = {
      entity: extractor.entity,
      extracted: 0,
      indexed: 0,
      pruned: 0,
      truncated: false,
      errors: [],
    }

    // Extract (synchronous, no I/O)
    let documents: unknown[]
    try {
      const result = extractor.extract(ctx)
      documents = result.documents
      state.extracted = documents.length
      state.truncated = result.truncated
    } catch (err: unknown) {
      state.errors.push({ phase: 'extract', message: err instanceof Error ? err.message : String(err) })
      return state
    }

    // Flip latest flag + bulk index
    try {
      await this._setLatestFalse(ctx.tenantId, extractor.entity, ctx.apiId)
      if (documents.length > 0) {
        await this.opensearchClient.bulk({
          body: documents.flatMap((doc) => {
            const d = doc as { id: string }
            return [{ index: { _index: config['opensearch.oaspec.index'](ctx.tenantId, extractor.entity), _id: d.id } }, doc]
          }),
          refresh: true,
        })
      }
      state.indexed = documents.length
    } catch (err: unknown) {
      state.errors.push({ phase: 'index', message: err instanceof Error ? err.message : String(err) })
    }

    // Prune old versions for this entity's index
    try {
      state.pruned = await this._pruneVersionsForEntity(ctx.tenantId, ctx.apiId, extractor.entity)
    } catch (err: unknown) {
      state.errors.push({ phase: 'prune', message: err instanceof Error ? err.message : String(err) })
    }

    return state
  }

  private async _setLatestFalse(tenantId: string, entity: OaspecEntity | string, apiId: string): Promise<void> {
    await this.opensearchClient.updateByQuery({
      index: config['opensearch.oaspec.index'](tenantId, entity),
      body: {
        query: { bool: { filter: [{ term: { apiId } }, { term: { latest: true } }] } },
        script: { source: 'ctx._source.latest = false', lang: 'painless' },
      },
      refresh: true,
    })
  }

  private async _pruneVersionsForEntity(tenantId: string, apiId: string, entity: OaspecEntity): Promise<number> {
    const retention = config['opensearch.oaspec.version-retention']
    const specIndex = config['opensearch.oaspec.index'](tenantId, 'spec')

    const response = await this.tsClient.searchTS<OaSpecDocument, Record<string, never>>({
      body: {
        query: { term: { apiId } } as never,
        sort: [{ indexedAt: { order: 'desc' } }] as never,
        size: 100,
      },
      index: specIndex,
    })

    const versionsToDelete = response.hits.hits.map((h) => h._source.version).slice(retention)
    if (versionsToDelete.length === 0) return 0

    const result = await this.opensearchClient.deleteByQuery({
      index: config['opensearch.oaspec.index'](tenantId, entity),
      body: { query: { bool: { filter: [{ term: { apiId } }, { terms: { version: versionsToDelete } }] } } },
      refresh: true,
    })

    return (result.body as { deleted?: number }).deleted ?? 0
  }
}
