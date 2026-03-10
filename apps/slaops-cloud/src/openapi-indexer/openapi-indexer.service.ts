/**
 * OpenAPI Indexer Service
 *
 * Responsibilities:
 *  1. Generate a pre-signed PUT URL to the OASpec staging bucket
 *  2. Download a spec from the staging bucket and validate it
 *  3. Save the validated spec to the OASpec storage bucket
 *  4. Index the spec document into OpenSearch
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Client } from '@opensearch-project/opensearch'
import {
  IndexResult,
  IndexingError,
  IndexingErrorCode,
  OpenApiIndexDocument,
} from '@slaops/cloud/openapi-search/types/openapi-index.types'
import { config } from '@slaops/config'
import * as yaml from 'yaml'
import { calculateId, OpenApiParserService } from './openapi-parser.service'

/**
 * Build an S3Client that works for both local (MinIO) and cloud environments.
 *
 * When a local (non-AWS) endpoint is configured the credential-provider chain is
 * bypassed by supplying credentials explicitly (MinIO default or whatever the
 * environment has). This avoids dynamic-import errors in Jest when
 * --experimental-vm-modules is absent.
 *
 * When the endpoint is an official AWS endpoint the normal SDK credential chain
 * is used so real AWS credentials are picked up from the environment.
 */
export function buildS3Client(): S3Client {
  const endpoint = config['aws.s3.endpoint']
  const isLocalEndpoint = endpoint && !endpoint.includes('amazonaws.com')
  if (isLocalEndpoint) {
    return new S3Client({
      region: config['aws.s3.region'],
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'minioadmin',
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'minioadmin',
      },
    })
  }
  return new S3Client({ region: config['aws.s3.region'] })
}

export interface PresignedUrlResult {
  url: string
  key: string
  bucket: string
  expiresIn: number
}

const PRESIGNED_URL_EXPIRES_IN = 3600 // 1 hour

@Injectable()
export class OpenApiIndexerService implements OnModuleInit {
  private readonly logger = new Logger(OpenApiIndexerService.name)
  private s3Client!: S3Client

  constructor(
    private readonly parserService: OpenApiParserService,
    private readonly opensearchClient: Client,
  ) {}

  async onModuleInit() {
    this.s3Client = buildS3Client()
  }

  // ---------------------------------------------------------------------------
  // 1. Generate pre-signed upload URL → staging bucket
  // ---------------------------------------------------------------------------

  async generatePresignedUploadUrl(key: string): Promise<PresignedUrlResult> {
    const bucket = config['slaops.oaspec.staging.bucket']
    const command = new PutObjectCommand({ Bucket: bucket, Key: key })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = await getSignedUrl(this.s3Client as any, command, {
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
    })
    return { url, key, bucket, expiresIn: PRESIGNED_URL_EXPIRES_IN }
  }

  // ---------------------------------------------------------------------------
  // 2. Download from staging + validate
  // ---------------------------------------------------------------------------

  async fetchAndValidate(
    bucket: string,
    key: string,
  ): Promise<{ content: string; document: OpenApiIndexDocument; truncated: boolean }> {
    const content = await this.fetchS3Object(bucket, key)
    const { document, truncated } = this.parserService.parseAndTransform(content, key, bucket)
    return { content, document, truncated }
  }

  // ---------------------------------------------------------------------------
  // 3. Save spec to OASpec storage bucket
  // ---------------------------------------------------------------------------

  async saveToStorage(content: string, key: string): Promise<void> {
    const bucket = config['slaops.oaspec.storage.bucket']
    const contentType = key.toLowerCase().endsWith('.json') ? 'application/json' : 'text/yaml'
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
      }),
    )
    this.logger.log(`Saved spec to storage: s3://${bucket}/${key}`)
  }

  // ---------------------------------------------------------------------------
  // 4. Index document into OpenSearch
  // ---------------------------------------------------------------------------

  async indexDocument(document: OpenApiIndexDocument) {
    const id = calculateId(document.provider, document.serviceName, document.version)
    return this.opensearchClient.index({
      index: config['opensearch.index.openapi.apis'],
      id,
      pipeline: config['opensearch.pipeline.openapi.apis'],
      body: document as unknown as Record<string, unknown>,
      refresh: true,
    })
  }

  // ---------------------------------------------------------------------------
  // Full pipeline: staging → validate → storage → OpenSearch
  // ---------------------------------------------------------------------------

  async processFromStaging(stagingBucket: string, key: string): Promise<IndexResult> {
    const startTime = Date.now()
    try {
      const { content, document, truncated } = await this.fetchAndValidate(stagingBucket, key)

      await this.saveToStorage(content, key)
      await this.indexDocument(document)

      const documentId = calculateId(document.provider, document.serviceName, document.version)
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
      this.logger.error(`Failed to process ${key} from staging:`, error)
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

  // ---------------------------------------------------------------------------
  // Direct content flow (body upload)
  // ---------------------------------------------------------------------------

  async createFromContent(content: string): Promise<IndexResult> {
    const startTime = Date.now()
    try {
      const key = this.deriveS3Key(content)
      const bucket = config['slaops.oaspec.storage.bucket']
      const { document, truncated } = this.parserService.parseAndTransform(content, key, bucket)

      await this.saveToStorage(content, key)
      await this.indexDocument(document)

      const documentId = calculateId(document.provider, document.serviceName, document.version)
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
      this.logger.error('Failed to create spec from content:', error)
      return {
        success: false,
        documentId: '',
        s3Key: '',
        operationCount: 0,
        pathCount: 0,
        truncated: false,
        error: error.message,
        duration: Date.now() - startTime,
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async fetchS3Object(bucket: string, key: string): Promise<string> {
    const response = await this.s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!response.Body) {
      throw new IndexingError(`Empty response body for ${key}`, IndexingErrorCode.S3_ERROR, key)
    }
    return response.Body.transformToString('utf-8')
  }

  async deleteDocument(documentId: string) {
    try {
      return await this.opensearchClient.delete({
        index: config['opensearch.index.openapi.apis'],
        id: documentId,
        refresh: true,
      })
    } catch (error: any) {
      if (error.statusCode !== 404) throw error
    }
  }

  /**
   * Derive the S3 key from the raw OpenAPI spec content using the APIs-guru
   * convention: APIs/{provider}/{service}/{version}/openapi.{yaml|json}
   */
  private deriveS3Key(content: string): string {
    let spec: any
    let format: 'yaml' | 'json' = 'yaml'

    try {
      spec = JSON.parse(content)
      format = 'json'
    } catch {
      try {
        const sanitized = content.replace(/^(\s*(?:-\s+)?[\w.-]+:\s+)(https?:)\s*$/gm, "$1'$2'")
        spec = yaml.parse(sanitized)
      } catch {
        // malformed – parseAndTransform will surface the real error
      }
      if (!spec) return 'APIs/unknown/default/unknown/openapi.yaml'
    }

    const version = spec?.info?.version ?? 'unknown'

    let provider = 'unknown'
    if (spec?.servers?.[0]?.url) {
      try {
        provider = new URL(spec.servers[0].url).hostname
      } catch {
        // non-parseable URL – keep default
      }
    }

    const service = spec?.info?.title
      ? spec.info.title
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : 'default'

    return `APIs/${provider}/${service}/${version}/openapi.${format}`
  }
}
