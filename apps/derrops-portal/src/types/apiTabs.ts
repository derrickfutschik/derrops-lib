/**
 * Response types for the API detail tab view endpoints.
 * These mirror the backend DTOs and should be replaced with generated client
 * models after running `pnpm --filter @derrops/cloud run build`.
 */

export interface PagedResult<T> {
  total: number
  from: number
  size: number
  hits: T[]
}

export interface VersionHit {
  id: string
  version: string
  latest: boolean
  specVersion: string
  indexedAt: string
  operationCount: number
  serverCount: number
  parameterCount: number
  modelCount: number
  fileSize: number
  fileFormat: 'yaml' | 'json'
}

export interface OperationHit {
  id: string
  apiId: string
  specId: string
  version: string
  latest: boolean
  method: string
  path: string
  operationId?: string
  summary?: string
  description?: string
  tagsText: string
  deprecated: boolean
  pathKey: string
  parameterIdsText: string
  requestModelId?: string
  responseModelIdsText: string
}

export interface ServerHit {
  id: string
  apiId: string
  specId: string
  version: string
  serverIndex: number
  latest: boolean
  rawUrl: string
  scheme: string
  hostTemplate: string
  hostShape: string
  dnsSuffix: string
  basePath: string
  description?: string
  fixedLabelsText: string
  varLabelsText: string
  variablesText?: string
}

export interface ParameterHit {
  id: string
  apiId: string
  specId: string
  version: string
  latest: boolean
  name: string
  location: string
  required: boolean
  deprecated: boolean
  description?: string
  schemaType?: string
  schemaFormat?: string
  exampleText?: string
  operationIdsText: string
}

export interface ModelHit {
  id: string
  apiId: string
  specId: string
  version: string
  latest: boolean
  name: string
  description?: string
  schemaType: string
  propertiesText: string
  operationIdsText: string
  usedInText: string
}
