/**
 * OpenAPI Indexer Lambda Handler
 *
 * Triggered by S3 events when OpenAPI specs are uploaded.
 * Parses the spec and indexes it into OpenSearch.
 *
 * This is a lightweight Lambda handler that bootstraps a minimal NestJS
 * application to use the OpenApiIndexerService.
 */

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { IndexResult } from '@derrops/cloud/openapi-search/types/openapi-index.types'
import type { Context, S3Event } from 'aws-lambda'
import { OpenApiIndexerModule, OpenApiIndexerService } from './openapi-indexer'

/**
 * Minimal module for the indexer Lambda
 * Only includes what's needed for indexing
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    OpenApiIndexerModule,
  ],
})
class IndexerLambdaModule {}

// Cache the service instance across Lambda invocations
let cachedService: OpenApiIndexerService | null = null

/**
 * Bootstrap the NestJS application and get the indexer service
 */
async function getIndexerService(): Promise<OpenApiIndexerService> {
  if (cachedService) {
    return cachedService
  }
  const app = await NestFactory.createApplicationContext(IndexerLambdaModule, {
    logger:
      process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug'],
  })
  const service = app.get(OpenApiIndexerService)
  cachedService = service
  return service
}

/**
 * Lambda handler for S3 events
 */
export async function handler(event: S3Event, context: Context): Promise<IndexResult[]> {
  console.log(`Processing ${event.Records.length} S3 event(s)`)

  if (process.env.DEBUG === 'true') {
    console.log('Event:', JSON.stringify(event, null, 2))
  }

  const indexerService = await getIndexerService()
  const results: IndexResult[] = []

  // Process records sequentially to avoid overwhelming OpenSearch
  for (const record of event.Records) {
    const s3Record = {
      bucket: record.s3.bucket.name,
      key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')),
      eventName: record.eventName,
    }

    // Direct S3-triggered indexing is not supported in the new pipeline —
    // indexing requires an apiId. Log the event and skip.
    console.warn(
      `S3-triggered indexing not supported without apiId. Bucket: ${s3Record.bucket}, Key: ${s3Record.key}`,
    )
    results.push({
      success: false,
      documentId: '',
      s3Key: s3Record.key,
      operationCount: 0,
      pathCount: 0,
      truncated: false,
      error: 'S3-triggered indexing requires an apiId — use POST /openapi/index instead',
      duration: 0,
    })
  }

  // Log summary
  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  console.log(`Completed: ${successful} successful, ${failed} failed`)

  return results
}
