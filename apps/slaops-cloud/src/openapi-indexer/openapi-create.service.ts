/**
 * OpenAPI Indexer Service - Handles S3 events and OpenSearch indexing
 */

import { S3Client } from '@aws-sdk/client-s3'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Client } from '@opensearch-project/opensearch'
import { config } from '@slaops/config'
import { TypescriptOSProxyClient } from 'opensearch-ts'
import * as yaml from 'yaml'
import { OpenApiParserService } from './openapi-parser.service'
import { OpenApiIndexerService } from './openapi-indexer.service'

@Injectable()
export class OpenAPICreateService {
  private readonly logger = new Logger(OpenAPICreateService.name)
  private readonly indexName: string
  private readonly debug: boolean
  private s3Client!: S3Client

  constructor(
    private readonly configService: ConfigService,
    private readonly parserService: OpenApiParserService,
    private readonly opensearchClient: Client,
    private readonly tsClient: TypescriptOSProxyClient,
    private readonly indexerService: OpenApiIndexerService,
  ) {
    this.indexName = config['opensearch.index.openapi.apis']
    this.debug = this.configService.get<string>('DEBUG') === 'true'
  }

  async createSpec(content: string): Promise<unknown> {
    const s3Key = this.deriveS3Key(content)
    const { document } = this.parserService.parseAndTransform(
      content,
      s3Key,
      config['openapi.s3.bucket'],
      'yaml',
    )
    const indexedResponse = await this.indexerService.indexDocument(document)
    console.log(JSON.stringify(indexedResponse, null, 2))
    return document
  }

  /**
   * Derive the S3 key from OpenAPI spec content following the APIs-guru convention:
   * APIs/{provider}/{service}/{version}/openapi.{yaml|json}
   *
   * - provider: hostname from the first server URL
   * - service: slugified info.title
   * - version: info.version
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
        // Malformed content — fall back to defaults; parseAndTransform will surface the real error
      }
      if (!spec) return 'APIs/unknown/default/unknown/openapi.yaml'
    }

    const version = spec?.info?.version ?? 'unknown'

    let provider = 'unknown'
    if (spec?.servers?.[0]?.url) {
      try {
        const url = new URL(spec.servers[0].url)
        provider = url.hostname
      } catch {
        // non-parseable URL, keep default
      }
    }

    const service = spec?.info?.title
      ? spec.info.title
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : 'default'

    const ext = format === 'json' ? 'json' : 'yaml'
    return `APIs/${provider}/${service}/${version}/openapi.${ext}`
  }
}
