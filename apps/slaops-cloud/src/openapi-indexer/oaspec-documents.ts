/**
 * TypeScript interfaces matching the OpenSearch document schemas for the five
 * per-tenant OASpec indices:
 *
 *   slaops--{tenantId}--oaspec--spec
 *   slaops--{tenantId}--oaspec--server
 *   slaops--{tenantId}--oaspec--operation
 *   slaops--{tenantId}--oaspec--param
 *   slaops--{tenantId}--oaspec--model
 *
 * Use these as the <T> type argument to TypescriptOSProxyClient.searchTS<T>()
 * and as the body type when bulk-indexing documents.
 */

export interface OaSpecDocument {
  id: string
  apiId: string
  tenantId: string
  version: string
  specVersion: string
  latest: boolean
  indexedAt: string
  updatedAt: string
  title: string
  description: string
  termsOfService?: string
  contactText?: string
  licenseText?: string
  externalDocsText?: string
  tagsText: string
  operationCount: number
  serverCount: number
  parameterCount: number
  modelCount: number
  s3Bucket: string
  s3Key: string
  fileSize: number
  fileFormat: 'yaml' | 'json'
}

export interface OaServerDocument {
  id: string
  apiId: string
  specId: string
  tenantId: string
  version: string
  serverIndex: number
  latest: boolean
  indexedAt: string
  rawUrl: string
  description?: string
  scheme: string
  hostTemplate: string
  hostShape: string
  dnsSuffix: string
  fixedLabelsText: string
  varLabelsText: string
  basePath: string
  variablesText?: string
}

export interface OaOperationDocument {
  id: string
  apiId: string
  specId: string
  tenantId: string
  version: string
  latest: boolean
  indexedAt: string
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

export interface OaParamDocument {
  id: string
  apiId: string
  specId: string
  tenantId: string
  version: string
  latest: boolean
  indexedAt: string
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

export interface OaModelDocument {
  id: string
  apiId: string
  specId: string
  tenantId: string
  version: string
  latest: boolean
  indexedAt: string
  name: string
  description?: string
  schemaType: string
  propertiesText: string
  operationIdsText: string
  usedInText: string
}

/** Shape returned from the platform catalogue search endpoint. */
export interface CatalogueHit {
  id: string
  title: string
  description?: string
  version?: string
  operationCount?: number
  serverCount?: number
  tagsText?: string
}
