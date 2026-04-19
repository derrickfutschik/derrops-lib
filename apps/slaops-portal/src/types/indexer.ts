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
  errors: Array<{ step: string; message: string }>
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
