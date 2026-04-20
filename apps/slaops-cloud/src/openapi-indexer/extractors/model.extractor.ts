import { config } from '@slaops/config'
import { OaModelDocument } from '../oaspec-documents'
import { oaspecId } from '../oaspec-id'
import {
  ExtractionContext,
  ExtractionResult,
  ISpecExtractor,
  OaspecEntity,
} from '../extractor.types'

type RawSchema = {
  description?: string
  type?: string
  properties?: Record<string, { type?: string; format?: string; description?: string }>
}

function buildPropertiesText(schema: RawSchema): string {
  const props = schema.properties ?? {}
  return Object.entries(props)
    .map(([name, prop]) => {
      const parts = [name, prop.type, prop.format].filter(Boolean).join(' ')
      return prop.description ? `${parts} - ${prop.description}` : parts
    })
    .join('\n')
}

export class ModelExtractor implements ISpecExtractor<OaModelDocument> {
  readonly entity: OaspecEntity = 'model'

  extract(ctx: ExtractionContext): ExtractionResult<OaModelDocument> {
    const { spec, tenantId, apiId, specId, version, indexedAt } = ctx
    const title: string = spec['info']?.title ?? ''
    const schemas: Record<string, RawSchema> = spec['components']?.schemas ?? {}

    const documents: OaModelDocument[] = Object.entries(schemas).map(([modelName, schema]) => ({
      id: oaspecId(tenantId, title, version, modelName),
      apiId,
      specId,
      tenantId,
      version,
      latest: true,
      indexedAt,
      name: modelName,
      description: schema.description,
      schemaType: schema.type ?? 'object',
      propertiesText: buildPropertiesText(schema),
      operationIdsText: '',
      usedInText: '',
    }))

    const limit = config['opensearch.oaspec.max-models-per-spec']
    const truncated = documents.length > limit

    return { documents: documents.slice(0, limit), truncated, warnings: [] }
  }
}
