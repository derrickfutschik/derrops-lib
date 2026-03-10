/**
 * Controller for the OpenAPI Indexer module.
 *
 * Endpoints:
 *   POST /openapi/upload-url   – generate a pre-signed PUT URL for the staging bucket
 *   POST /openapi/index        – process a spec already uploaded to S3 (staging → storage + OpenSearch)
 *   POST /openapi              – index a spec submitted directly as a request body (JSON or YAML)
 */

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common'
import { IndexResult } from '@slaops/cloud/openapi-search/types/openapi-index.types'
import { OpenApiIndexerService, PresignedUrlResult } from './openapi-indexer.service'

class UploadUrlDto {
  key!: string
}

class IndexFromS3Dto {
  bucket!: string
  key!: string
}

@Controller('openapi')
export class OpenApiIndexerController {
  constructor(private readonly indexerService: OpenApiIndexerService) {}

  /**
   * Generate a pre-signed PUT URL for uploading an OASpec to the staging bucket.
   *
   * Body: { key: string }  – S3 key, e.g. "APIs/ably.net/control/v1/openapi.yaml"
   */
  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  async getUploadUrl(@Body() body: UploadUrlDto): Promise<PresignedUrlResult> {
    if (!body?.key) {
      throw new BadRequestException('Missing required field: key')
    }
    return this.indexerService.generatePresignedUploadUrl(body.key)
  }

  /**
   * Process a spec that has already been uploaded to S3 (typically the staging bucket).
   * Validates the spec, saves it to the storage bucket, and indexes it into OpenSearch.
   *
   * Body: { bucket: string, key: string }
   */
  @Post('index')
  @HttpCode(HttpStatus.OK)
  async indexFromS3(@Body() body: IndexFromS3Dto): Promise<IndexResult> {
    if (!body?.bucket || !body?.key) {
      throw new BadRequestException('Missing required fields: bucket, key')
    }
    return this.indexerService.processFromStaging(body.bucket, body.key)
  }

  /**
   * Accept an OpenAPI spec as a request body (JSON object or YAML/JSON string),
   * save it to the storage bucket, and index it into OpenSearch.
   *
   * Supports Content-Type: application/json, text/plain, text/yaml, application/yaml.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async indexFromBody(@Body() body: string | Record<string, unknown>): Promise<IndexResult> {
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      throw new BadRequestException(
        'Empty request body. Send an OpenAPI spec as JSON or YAML (Content-Type: application/json, text/yaml, or text/plain).',
      )
    }
    const content = typeof body === 'string' ? body : JSON.stringify(body)
    return this.indexerService.createFromContent(content)
  }
}
