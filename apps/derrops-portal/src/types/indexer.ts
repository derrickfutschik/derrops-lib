export interface PresignedUrlResult {
  url: string
  key: string
  bucket: string
  expiresIn: number
}

export type OaspecEntity = 'spec' | 'server' | 'operation' | 'param' | 'model'

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

export interface IndexingResponse {
  success: boolean
  apiId: string
  version: string
  specOpensearchId: string
  durationMs: number
  states: ExtractionState[]
}

export interface CatalogueHit {
  id: string
  title: string
  description?: string
  version?: string
  operationCount?: number
  serverCount?: number
  tagsText?: string
}

export interface CatalogueResponse {
  total: number
  hits: CatalogueHit[]
}
