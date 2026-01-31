/**
 * OpenAPI Indexer Lambda Handler
 *
 * Triggered by S3 events when OpenAPI specs are uploaded.
 * Parses the spec and indexes it into OpenSearch.
 *
 * This is a lightweight Lambda handler that bootstraps a minimal NestJS
 * application to use the OpenApiIndexerService.
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { S3Event, Context } from 'aws-lambda';
import { OpenApiIndexerModule, OpenApiIndexerService } from './openapi-indexer';
import { IndexResult } from '@slaops/slaops-cloud/openapi-search/types/openapi-index.types';

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
class IndexerLambdaModule { }

// Cache the service instance across Lambda invocations
let cachedService: OpenApiIndexerService | null = null;

/**
 * Bootstrap the NestJS application and get the indexer service
 */
async function getIndexerService(): Promise<OpenApiIndexerService> {
  if (!cachedService) {
    const app = await NestFactory.createApplicationContext(IndexerLambdaModule, {
      logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug'],
    });

    cachedService = app.get(OpenApiIndexerService);
  }

  return cachedService;
}

/**
 * Lambda handler for S3 events
 */
export async function handler(event: S3Event, context: Context): Promise<IndexResult[]> {
  console.log(`Processing ${event.Records.length} S3 event(s)`);

  if (process.env.DEBUG === 'true') {
    console.log('Event:', JSON.stringify(event, null, 2));
  }

  const indexerService = await getIndexerService();
  const results: IndexResult[] = [];

  // Process records sequentially to avoid overwhelming OpenSearch
  for (const record of event.Records) {
    const s3Record = {
      bucket: record.s3.bucket.name,
      key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')),
      eventName: record.eventName,
    };

    const result = await indexerService.processRecord(s3Record);
    results.push(result);
  }

  // Log summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`Completed: ${successful} successful, ${failed} failed`);

  return results;
}
