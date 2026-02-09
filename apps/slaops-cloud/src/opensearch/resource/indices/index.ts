import { apiIndexTemplate } from './openapi.api.template'
import { operationIndexTemplate } from './openapi.operation.template'

export const ALL_INDICES_TEMPLATES = [apiIndexTemplate, operationIndexTemplate] as const
