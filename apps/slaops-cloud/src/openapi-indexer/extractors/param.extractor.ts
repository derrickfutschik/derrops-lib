import { config } from '@slaops/config'
import { OaParamDocument } from '../oaspec-documents'
import { oaspecId } from '../oaspec-id'
import { ExtractionContext, ExtractionResult, ISpecExtractor, OaspecEntity } from '../extractor.types'

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const

type RawParam = {
  name?: string
  in?: string
  required?: boolean
  deprecated?: boolean
  description?: string
  schema?: { type?: string; format?: string }
  example?: unknown
}

export class ParamExtractor implements ISpecExtractor<OaParamDocument> {
  readonly entity: OaspecEntity = 'param'

  extract(ctx: ExtractionContext): ExtractionResult<OaParamDocument> {
    const { spec, tenantId, apiId, specId, version, indexedAt } = ctx
    const title: string = spec['info']?.title ?? ''
    const paths: Record<string, Record<string, { parameters?: RawParam[] }>> = spec['paths'] ?? {}

    const paramMap = new Map<string, { doc: Omit<OaParamDocument, 'operationIdsText'>; operationIds: Set<string> }>()

    const addParam = (name: string, location: string, param: RawParam, opId?: string) => {
      const paramId = oaspecId(tenantId, title, version, name, location)
      if (!paramMap.has(paramId)) {
        paramMap.set(paramId, {
          doc: {
            id: paramId,
            apiId,
            specId,
            tenantId,
            version,
            latest: true,
            indexedAt,
            name: param.name ?? name,
            location,
            required: param.required ?? (location === 'path'),
            deprecated: param.deprecated ?? false,
            description: param.description,
            schemaType: param.schema?.type,
            schemaFormat: param.schema?.format,
            exampleText: param.example != null ? JSON.stringify(param.example) : undefined,
          },
          operationIds: new Set(),
        })
      }
      if (opId) paramMap.get(paramId)!.operationIds.add(opId)
    }

    // Shared components.parameters
    for (const [name, param] of Object.entries<RawParam>(spec['components']?.parameters ?? {})) {
      addParam(param.name ?? name, param.in ?? 'query', param)
    }

    // Per-operation parameters
    for (const [path, pathItem] of Object.entries(paths)) {
      for (const method of HTTP_METHODS) {
        const op = pathItem[method]
        if (!op?.parameters) continue
        const opId = oaspecId(tenantId, title, version, method.toUpperCase(), path)
        for (const param of op.parameters as RawParam[]) {
          addParam(param.name ?? '', param.in ?? 'query', param, opId)
        }
      }
    }

    const documents: OaParamDocument[] = Array.from(paramMap.values()).map(({ doc, operationIds }) => ({
      ...doc,
      operationIdsText: Array.from(operationIds).join(' '),
    }))

    const limit = config['opensearch.oaspec.max-params-per-spec']
    const truncated = documents.length > limit

    return { documents: documents.slice(0, limit), truncated, warnings: [] }
  }
}
