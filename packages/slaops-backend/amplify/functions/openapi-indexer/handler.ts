/**
 * OpenAPI Indexer Lambda Handler
 *
 * Triggered by S3 events when OpenAPI specs are uploaded.
 * Parses the spec and indexes it into OpenSearch.
 */

import type { S3Event, Context } from 'aws-lambda';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { IndexResult, IndexingError, IndexingErrorCode, OpenApiIndexDocument } from './types';
import { parseAndTransform } from './parser';

// Initialize clients (reused across invocations)
const s3Client = new S3Client({});
let opensearchClient: Client | null = null;

const INDEX_NAME = process.env.OPENSEARCH_INDEX_NAME || 'slaops-openapis';
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT;
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const DEBUG = process.env.DEBUG === 'true';

/**
 * Get or create OpenSearch client
 */
function getOpenSearchClient(): Client {
  if (!opensearchClient) {
    if (!OPENSEARCH_ENDPOINT) {
      throw new Error('OPENSEARCH_ENDPOINT environment variable is required');
    }

    opensearchClient = new Client({
      ...AwsSigv4Signer({
        region: AWS_REGION,
        service: 'aoss', // OpenSearch Serverless
        getCredentials: () => {
          const credentialsProvider = defaultProvider();
          return credentialsProvider();
        },
      }),
      node: OPENSEARCH_ENDPOINT,
    });
  }

  return opensearchClient;
}

/**
 * Fetch object content from S3
 */
async function fetchS3Object(bucket: string, key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new IndexingError(`Empty response body for ${key}`, IndexingErrorCode.S3_ERROR, key);
  }

  return response.Body.transformToString('utf-8');
}

/**
 * Index document to OpenSearch
 */
async function indexDocument(client: Client, documentId: string, document: OpenApiIndexDocument): Promise<void> {
  await client.index({
    index: INDEX_NAME,
    id: documentId,
    body: document as unknown as Record<string, unknown>,
    refresh: true,
  });
}

/**
 * Delete document from OpenSearch
 */
async function deleteDocument(client: Client, documentId: string): Promise<void> {
  try {
    await client.delete({
      index: INDEX_NAME,
      id: documentId,
      refresh: true,
    });
  } catch (error: any) {
    // Ignore 404 errors (document doesn't exist)
    if (error.statusCode !== 404) {
      throw error;
    }
  }
}

/**
 * Extract document ID from S3 key
 * Format: APIs/{provider}/{service}/{version}/... -> {provider}/{service}/{version}
 */
function extractDocumentId(s3Key: string): string {
  const normalizedKey = s3Key.replace(/^APIs\//, '');
  const parts = normalizedKey.split('/');

  if (parts.length < 3) {
    throw new IndexingError(`Invalid S3 key format: ${s3Key}`, IndexingErrorCode.INVALID_PATH, s3Key);
  }

  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

/**
 * Check if the S3 key matches expected pattern
 */
function isValidOpenApiPath(s3Key: string): boolean {
  // Expected: APIs/{provider}/{service}/{version}/openapi.{yaml|json}
  // or: APIs/{provider}/{service}/{version}/swagger.{yaml|json}
  const pattern = /^APIs\/[^/]+\/[^/]+\/[^/]+\/(openapi|swagger)\.(yaml|yml|json)$/i;
  return pattern.test(s3Key);
}

/**
 * Process a single S3 record
 */
async function processRecord(
  record: { bucket: string; key: string; eventName: string },
  client: Client,
): Promise<IndexResult> {
  const startTime = Date.now();
  const { bucket, key, eventName } = record;

  // Skip non-OpenAPI files
  if (!isValidOpenApiPath(key)) {
    if (DEBUG) {
      console.log(`Skipping non-OpenAPI file: ${key}`);
    }
    return {
      success: true,
      documentId: '',
      s3Key: key,
      operationCount: 0,
      pathCount: 0,
      truncated: false,
      duration: Date.now() - startTime,
    };
  }

  try {
    const documentId = extractDocumentId(key);

    // Handle delete events
    if (eventName.startsWith('ObjectRemoved')) {
      await deleteDocument(client, documentId);
      console.log(`Deleted document: ${documentId}`);
      return {
        success: true,
        documentId,
        s3Key: key,
        operationCount: 0,
        pathCount: 0,
        truncated: false,
        duration: Date.now() - startTime,
      };
    }

    // Handle create/update events
    console.log(`Processing: ${key}`);

    // Fetch content from S3
    const content = await fetchS3Object(bucket, key);

    // Parse and transform
    const { document, truncated } = parseAndTransform(content, key, bucket);

    // Index to OpenSearch
    await indexDocument(client, documentId, document);

    console.log(
      `Indexed: ${documentId} (${document.operationStats.total} operations, ${document.paths.length} paths${truncated ? ', truncated' : ''})`,
    );

    return {
      success: true,
      documentId,
      s3Key: key,
      operationCount: document.operationStats.total,
      pathCount: document.paths.length,
      truncated,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error(`Failed to process ${key}:`, error);

    return {
      success: false,
      documentId: '',
      s3Key: key,
      operationCount: 0,
      pathCount: 0,
      truncated: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Lambda handler for S3 events
 */
export async function handler(event: S3Event, context: Context): Promise<IndexResult[]> {
  console.log(`Processing ${event.Records.length} S3 event(s)`);

  if (DEBUG) {
    console.log('Event:', JSON.stringify(event, null, 2));
  }

  const client = getOpenSearchClient();
  const results: IndexResult[] = [];

  // Process records sequentially to avoid overwhelming OpenSearch
  for (const record of event.Records) {
    const s3Record = {
      bucket: record.s3.bucket.name,
      key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')),
      eventName: record.eventName,
    };

    const result = await processRecord(s3Record, client);
    results.push(result);
  }

  // Log summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`Completed: ${successful} successful, ${failed} failed`);

  return results;
}
