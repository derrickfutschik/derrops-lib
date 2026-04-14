import { Service } from '@/client/slaops-cloud/models/service'

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export interface ParameterInfo {
  name: string
  type: string
  required: boolean
  value: string | null
  defaultValue?: string | null
  isUsingDefault: boolean
  isUnspecified: boolean
  isValid: boolean
  validationReason: string
  description?: string
  rawJson: object
}

export interface ServerVariable {
  name: string
  value: string
  default: string
  description?: string
  enum?: string[]
}

export interface ServerInfo {
  index: number
  url: string
  resolvedUrl: string
  description?: string
  variables: ServerVariable[]
}

export interface BodyPropertyInfo {
  name: string
  type: string
  required: boolean
  value: any
  isValid: boolean
  validationReason: string
  description?: string
  rawJson: object
}

export interface MatchResult {
  matched: boolean
  service: Service | null
  server: ServerInfo | null
  operation: {
    path: string
    method: string
    operationId?: string
    summary?: string
    description?: string
    pathParameters: ParameterInfo[]
    queryParameters: ParameterInfo[]
    headerParameters: ParameterInfo[]
    bodyProperties: BodyPropertyInfo[]
    bodyContentType?: string
    responseSchema?: any
  } | null
  validationErrors: string[]
  validationWarnings: string[]
  spec: any
}

export interface OperationOption {
  key: string
  method: string
  path: string
  operationId?: string
  summary?: string
  description?: string
}

export type ActionMode = 'analyze' | 'request' | 'preview'
export type BuilderMode = 'standard' | 'openapi'
export type SortColumn = 'name' | 'type' | 'required' | 'value' | 'isValid'
export type SortDirection = 'asc' | 'desc'
