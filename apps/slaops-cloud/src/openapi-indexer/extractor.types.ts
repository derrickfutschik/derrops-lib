export type OaspecEntity = 'spec' | 'server' | 'operation' | 'param' | 'model'

export interface ExtractionContext {
  tenantId: string
  apiId: string
  /** SHA256_16(tenantId, info.title, info.version) — pre-computed before any extractor runs */
  specId: string
  version: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec: Record<string, any>
  indexedAt: string
  s3Bucket: string
  s3Key: string
  fileSize: number
  fileFormat: 'yaml' | 'json'
}

export interface ExtractionResult<TDoc> {
  documents: TDoc[]
  truncated: boolean
  warnings: string[]
}

export interface ExtractionError {
  phase: 'extract' | 'index' | 'prune'
  message: string
}

export interface ExtractionState {
  entity: OaspecEntity
  extracted: number
  indexed: number
  pruned: number
  truncated: boolean
  errors: ExtractionError[]
}

export interface ISpecExtractor<TDoc> {
  readonly entity: OaspecEntity
  extract(context: ExtractionContext): ExtractionResult<TDoc>
}
