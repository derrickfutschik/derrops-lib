import { apiIndexTemplate } from './openapi.api.template'
import { operationIndexTemplate } from './openapi.operation.template'
import { oaspecSpecTemplate } from './oaspec.spec.template'
import { oaspecServerTemplate } from './oaspec.server.template'
import { oaspecOperationTemplate } from './oaspec.operation.template'
import { oaspecParamTemplate } from './oaspec.param.template'
import { oaspecModelTemplate } from './oaspec.model.template'

export const ALL_INDICES_TEMPLATES = [
  apiIndexTemplate,
  operationIndexTemplate,
  oaspecSpecTemplate,
  oaspecServerTemplate,
  oaspecOperationTemplate,
  oaspecParamTemplate,
  oaspecModelTemplate,
] as const
