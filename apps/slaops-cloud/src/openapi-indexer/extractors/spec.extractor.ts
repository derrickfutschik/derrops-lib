import { OaSpecDocument } from '../oaspec-documents'
import { ExtractionContext, ExtractionResult, ISpecExtractor, OaspecEntity } from '../extractor.types'

export class SpecExtractor implements ISpecExtractor<OaSpecDocument> {
  readonly entity: OaspecEntity = 'spec'

  extract(ctx: ExtractionContext): ExtractionResult<OaSpecDocument> {
    const { spec, tenantId, apiId, specId, version, indexedAt, s3Bucket, s3Key, fileSize, fileFormat } = ctx

    const tagsText = (spec['tags']?.map((t: { name: string }) => t.name) ?? []).join(' ')

    const contactText = spec['info']?.contact
      ? [spec['info'].contact.name, spec['info'].contact.email, spec['info'].contact.url]
          .filter(Boolean).join(' ')
      : undefined

    const licenseText = spec['info']?.license
      ? [spec['info'].license.name, spec['info'].license.url].filter(Boolean).join(' ')
      : undefined

    const externalDocsText = spec['externalDocs']
      ? [spec['externalDocs'].description, spec['externalDocs'].url].filter(Boolean).join(' ')
      : undefined

    const doc: OaSpecDocument = {
      id: specId,
      apiId,
      tenantId,
      version,
      specVersion: spec['openapi'],
      latest: true,
      indexedAt,
      updatedAt: indexedAt,
      title: spec['info']?.title ?? '',
      description: spec['info']?.description ?? '',
      termsOfService: spec['info']?.termsOfService,
      contactText,
      licenseText,
      externalDocsText,
      tagsText,
      // Counts are back-filled by the service after all extractors run
      operationCount: 0,
      serverCount: 0,
      parameterCount: 0,
      modelCount: 0,
      s3Bucket,
      s3Key,
      fileSize,
      fileFormat,
    }

    return { documents: [doc], truncated: false, warnings: [] }
  }
}
