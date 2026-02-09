import { apiPipeline } from './openapi.api.pipeline'
import { operationPipeline } from './openapi.operation.pipeline'

export const ALL_INGEST_PIPELINES = [apiPipeline, operationPipeline] as const
