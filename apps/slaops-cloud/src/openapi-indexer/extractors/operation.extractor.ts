import { config } from '@slaops/config'
import { OaOperationDocument } from '../oaspec-documents'
import { oaspecId } from '../oaspec-id'
import { ExtractionContext, ExtractionResult, ISpecExtractor, OaspecEntity } from '../extractor.types'

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const

const METHOD_INITIAL: Record<string, string> = {
  GET: 'G', POST: 'P', PUT: 'U', DELETE: 'D', PATCH: 'A', HEAD: 'H', OPTIONS: 'O',
}

function compactPath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((seg) => (seg.startsWith('{') ? '{i}' : seg))
    .join('/')
}

type RawOperation = {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  deprecated?: boolean
  parameters?: unknown[]
}

export class OperationExtractor implements ISpecExtractor<OaOperationDocument> {
  readonly entity: OaspecEntity = 'operation'

  extract(ctx: ExtractionContext): ExtractionResult<OaOperationDocument> {
    const { spec, tenantId, apiId, specId, version, indexedAt } = ctx
    const title: string = spec['info']?.title ?? ''
    const paths: Record<string, Record<string, RawOperation>> = spec['paths'] ?? {}

    const documents: OaOperationDocument[] = []

    for (const [path, pathItem] of Object.entries(paths)) {
      for (const method of HTTP_METHODS) {
        const op = pathItem[method]
        if (!op) continue

        const methodUpper = method.toUpperCase()
        const pathKey = `${METHOD_INITIAL[methodUpper] ?? methodUpper[0]!}:${compactPath(path)}`
        const opId = oaspecId(tenantId, title, version, methodUpper, path)

        documents.push({
          id: opId,
          apiId,
          specId,
          tenantId,
          version,
          latest: true,
          indexedAt,
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

    const limit = config['opensearch.oaspec.max-operations-per-spec']
    const truncated = documents.length > limit

    return { documents: documents.slice(0, limit), truncated, warnings: [] }
  }
}
