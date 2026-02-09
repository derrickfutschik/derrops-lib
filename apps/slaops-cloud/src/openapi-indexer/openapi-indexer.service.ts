/**
 * OpenAPI Indexer Service - Handles S3 events and OpenSearch indexing
 */

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Client } from '@opensearch-project/opensearch'
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws'
import {
  IndexResult,
  IndexingError,
  IndexingErrorCode,
  OpenApiIndexDocument,
} from '@slaops/cloud/openapi-search/types/openapi-index.types'
import { config } from '@slaops/config'
import { TypescriptOSProxyClient } from 'opensearch-ts'
import { OpenApiParserService } from './openapi-parser.service'

@Injectable()
export class OpenApiIndexerService implements OnModuleInit {
  private readonly logger = new Logger(OpenApiIndexerService.name)
  private readonly indexName: string
  private readonly debug: boolean

  private s3Client!: S3Client
  private opensearchClient!: Client
  private tsClient!: TypescriptOSProxyClient

  constructor(
    private readonly configService: ConfigService,
    private readonly parserService: OpenApiParserService,
  ) {
    this.indexName = config['opensearch.index.openapi.apis']
    this.debug = this.configService.get<string>('DEBUG') === 'true'
  }

  async onModuleInit() {
    // Initialize S3 client
    this.s3Client = new S3Client({})

    // Initialize OpenSearch client
    const endpoint = config['aws.accountId']
    const region = config['aws.region']

    if (!endpoint) {
      this.logger.warn('OPENSEARCH_ENDPOINT not configured, indexing will not be available')
      return
    }

    try {
      this.opensearchClient = new Client({
        ...AwsSigv4Signer({
          region,
          service: 'aoss', // OpenSearch Serverless
          getCredentials: () => {
            const credentialsProvider = defaultProvider()
            return credentialsProvider()
          },
        }),
        node: endpoint,
      })

      this.tsClient = new TypescriptOSProxyClient(this.opensearchClient)

      this.logger.log(`Connected to OpenSearch at ${endpoint}`)
    } catch (error) {
      this.logger.error('Failed to initialize OpenSearch client', error)
    }
  }

  /**
   * Fetch object content from S3
   */
  async fetchS3Object(bucket: string, key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const response = await this.s3Client.send(command)

    if (!response.Body) {
      throw new IndexingError(`Empty response body for ${key}`, IndexingErrorCode.S3_ERROR, key)
    }

    return response.Body.transformToString('utf-8')
  }

  /**
   * Index document to OpenSearch
   */
  async indexDocument(documentId: string, document: OpenApiIndexDocument): Promise<void> {
    await this.opensearchClient.index({
      index: this.indexName,
      id: documentId,
      pipeline: config['opensearch.pipeline.openapi.apis'],
      body: document as unknown as Record<string, unknown>,
      refresh: true,
    })
  }

  /**
   * Delete document from OpenSearch
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await this.opensearchClient.delete({
        index: this.indexName,
        id: documentId,
        refresh: true,
      })
    } catch (error: any) {
      // Ignore 404 errors (document doesn't exist)
      if (error.statusCode !== 404) {
        throw error
      }
    }
  }

  /**
   * Extract document ID from S3 key
   * Format: APIs/{provider}/{service}/{version}/... -> {provider}/{service}/{version}
   */
  extractDocumentId(s3Key: string): string {
    const normalizedKey = s3Key.replace(/^APIs\//, '')
    const parts = normalizedKey.split('/')

    if (parts.length < 3) {
      throw new IndexingError(
        `Invalid S3 key format: ${s3Key}`,
        IndexingErrorCode.INVALID_PATH,
        s3Key,
      )
    }

    return `${parts[0]}/${parts[1]}/${parts[2]}`
  }

  /**
   * Check if the S3 key matches expected pattern
   */
  isValidOpenApiPath(s3Key: string): boolean {
    // Expected: APIs/{provider}/{service}/{version}/openapi.{yaml|json}
    // or: APIs/{provider}/{service}/{version}/swagger.{yaml|json}
    const pattern = /^APIs\/[^/]+\/[^/]+\/[^/]+\/(openapi|swagger)\.(yaml|yml|json)$/i
    return pattern.test(s3Key)
  }

  /**
   * Process a single S3 record
   */
  async processRecord(record: {
    bucket: string
    key: string
    eventName: string
  }): Promise<IndexResult> {
    const startTime = Date.now()
    const { bucket, key, eventName } = record

    // Skip non-OpenAPI files
    if (!this.isValidOpenApiPath(key)) {
      if (this.debug) {
        this.logger.debug(`Skipping non-OpenAPI file: ${key}`)
      }
      return {
        success: true,
        documentId: '',
        s3Key: key,
        operationCount: 0,
        pathCount: 0,
        truncated: false,
        duration: Date.now() - startTime,
      }
    }

    try {
      const documentId = this.extractDocumentId(key)

      // Handle delete events
      if (eventName.startsWith('ObjectRemoved')) {
        await this.deleteDocument(documentId)
        this.logger.log(`Deleted document: ${documentId}`)
        return {
          success: true,
          documentId,
          s3Key: key,
          operationCount: 0,
          pathCount: 0,
          truncated: false,
          duration: Date.now() - startTime,
        }
      }

      // Handle create/update events
      this.logger.log(`Processing: ${key}`)

      // Fetch content from S3
      const content = await this.fetchS3Object(bucket, key)

      // Parse and transform
      const { document, truncated } = this.parserService.parseAndTransform(content, key, bucket)

      // Index to OpenSearch
      await this.indexDocument(documentId, document)

      this.logger.log(
        `Indexed: ${documentId} (${document.operationStats.total} operations, ${document.paths.length} paths${truncated ? ', truncated' : ''})`,
      )

      return {
        success: true,
        documentId,
        s3Key: key,
        operationCount: document.operationStats.total,
        pathCount: document.paths.length,
        truncated,
        duration: Date.now() - startTime,
      }
    } catch (error: any) {
      this.logger.error(`Failed to process ${key}:`, error)

      return {
        success: false,
        documentId: '',
        s3Key: key,
        operationCount: 0,
        pathCount: 0,
        truncated: false,
        error: error.message,
        duration: Date.now() - startTime,
      }
    }
  }
}
