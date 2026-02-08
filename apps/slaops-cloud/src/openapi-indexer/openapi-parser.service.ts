/**
 * OpenAPI Parser Service - Parses OpenAPI 3.x specs and transforms them for indexing
 */

import { Injectable } from '@nestjs/common';
import * as yaml from 'yaml';
import {
  OpenApiIndexDocument,
  IndexingError,
  IndexingErrorCode,
  INDEXING_LIMITS,
} from '@slaops/cloud/openapi-search/types/openapi-index.types';

/**
 * OpenAPI 3.x specification (simplified type)
 */
interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths?: Record<string, PathItem>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
  externalDocs?: {
    url: string;
    description?: string;
  };
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  head?: Operation;
  options?: Operation;
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;

@Injectable()
export class OpenApiParserService {
  /**
   * Detect file format from S3 key
   */
  detectFormat(s3Key: string): 'yaml' | 'json' {
    const lowerKey = s3Key.toLowerCase();
    if (lowerKey.endsWith('.json')) {
      return 'json';
    }
    return 'yaml';
  }

  /**
   * Parse content based on format
   */
  parseContent(content: string, format: 'yaml' | 'json'): unknown {
    try {
      if (format === 'json') {
        return JSON.parse(content);
      }
      return yaml.parse(content);
    } catch (error: any) {
      throw new IndexingError(
        `Failed to parse ${format.toUpperCase()}: ${error.message}`,
        IndexingErrorCode.PARSE_ERROR,
        '',
        error,
      );
    }
  }

  /**
   * Extract path components from S3 key
   * Expected format: APIs/{provider}/{service}/{version}/openapi.{yaml|json}
   */
  extractPathComponents(s3Key: string): { provider: string; service: string; version: string } {
    // Remove leading APIs/ if present
    const normalizedKey = s3Key.replace(/^APIs\//, '');
    const parts = normalizedKey.split('/');

    if (parts.length < 4) {
      throw new IndexingError(
        `Invalid S3 key format. Expected: APIs/{provider}/{service}/{version}/openapi.{yaml|json}, got: ${s3Key}`,
        IndexingErrorCode.INVALID_PATH,
        s3Key,
      );
    }

    const provider = parts[0];
    const service = parts[1];
    const version = parts[2];

    if (!provider || !service || !version) {
      throw new IndexingError(
        `Invalid S3 key format. Missing provider, service, or version: ${s3Key}`,
        IndexingErrorCode.INVALID_PATH,
        s3Key,
      );
    }

    return { provider, service, version };
  }

  /**
   * Validate that the spec is OpenAPI 3.x
   */
  validateOpenApi3(spec: unknown, s3Key: string): asserts spec is OpenApiSpec {
    const s = spec as any;

    if (!s || typeof s !== 'object') {
      throw new IndexingError('Invalid OpenAPI spec: not an object', IndexingErrorCode.VALIDATION_ERROR, s3Key);
    }

    if (!s.openapi || typeof s.openapi !== 'string') {
      throw new IndexingError(
        'Invalid OpenAPI spec: missing or invalid "openapi" field',
        IndexingErrorCode.NOT_OPENAPI_3,
        s3Key,
      );
    }

    if (!s.openapi.startsWith('3.')) {
      throw new IndexingError(
        `Only OpenAPI 3.x specs are supported, found: ${s.openapi}`,
        IndexingErrorCode.NOT_OPENAPI_3,
        s3Key,
      );
    }

    if (!s.info || typeof s.info !== 'object' || !s.info.title) {
      throw new IndexingError('Invalid OpenAPI spec: missing info.title', IndexingErrorCode.VALIDATION_ERROR, s3Key);
    }
  }

  /**
   * Extract unique tags from spec (both top-level and from operations)
   */
  private extractUniqueTags(spec: OpenApiSpec): string[] {
    const tags = new Set<string>();

    // Top-level tags
    if (spec.tags) {
      for (const tag of spec.tags) {
        if (tag.name) {
          tags.add(tag.name);
        }
      }
    }

    // Tags from operations
    if (spec.paths) {
      for (const pathItem of Object.values(spec.paths)) {
        for (const method of HTTP_METHODS) {
          const operation = pathItem[method];
          if (operation?.tags) {
            for (const tag of operation.tags) {
              tags.add(tag);
            }
          }
        }
      }
    }

    return Array.from(tags);
  }

  /**
   * Extract path prefix (first segment)
   */
  private extractPathPrefix(path: string): string {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) {
      return '/';
    }
    return '/' + segments[0];
  }

  /**
   * Transform OpenAPI spec into index document
   */
  transformToIndexDocument(
    spec: OpenApiSpec,
    s3Key: string,
    bucket: string,
    fileSize: number,
    format: 'yaml' | 'json',
  ): { document: OpenApiIndexDocument; truncated: boolean } {
    const { provider, service, version } = this.extractPathComponents(s3Key);

    // Collect operations data
    const allOperations: Array<{
      method: string;
      path: string;
      operationId?: string;
      summary?: string;
      description?: string;
    }> = [];
    const methodCounts: Record<string, number> = {};
    const pathPrefixes = new Set<string>();
    const operationIds: string[] = [];
    const searchTextParts: string[] = [];

    if (spec.paths) {
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        // Extract path prefix
        const prefix = this.extractPathPrefix(path);
        pathPrefixes.add(prefix);

        for (const method of HTTP_METHODS) {
          const operation = pathItem[method];
          if (operation) {
            const methodUpper = method.toUpperCase();

            // Count methods
            methodCounts[methodUpper] = (methodCounts[methodUpper] || 0) + 1;

            // Collect operation IDs (max limit)
            if (operation.operationId && operationIds.length < INDEXING_LIMITS.MAX_OPERATION_IDS) {
              operationIds.push(operation.operationId);
            }

            // Build search text
            if (operation.summary) {
              searchTextParts.push(operation.summary);
            }
            if (operation.description) {
              searchTextParts.push(operation.description);
            }

            // Collect operation for sampling
            allOperations.push({
              method: methodUpper,
              path,
              operationId: operation.operationId,
              summary: operation.summary,
              description: operation.description,
            });
          }
        }
      }
    }

    // Apply dimensionality limits
    const allPaths = spec.paths ? Object.keys(spec.paths) : [];
    const truncated =
      allPaths.length > INDEXING_LIMITS.MAX_PATHS ||
      allOperations.length > INDEXING_LIMITS.MAX_SAMPLE_OPERATIONS ||
      operationIds.length >= INDEXING_LIMITS.MAX_OPERATION_IDS;

    const sampleOperations = allOperations.slice(0, INDEXING_LIMITS.MAX_SAMPLE_OPERATIONS).map((op) => ({
      method: op.method,
      path: op.path,
      operationId: op.operationId,
      summary: op.summary,
    }));

    const paths = allPaths.slice(0, INDEXING_LIMITS.MAX_PATHS);
    const operationSearchText = searchTextParts.join(' ').slice(0, INDEXING_LIMITS.MAX_SEARCH_TEXT_LENGTH);

    const now = new Date().toISOString();

    const document: OpenApiIndexDocument = {
      id: `${provider}/${service}/${version}`,
      provider,
      serviceName: service,
      version,
      specVersion: spec.openapi,
      title: spec.info.title,
      description: spec.info.description || '',
      termsOfService: spec.info.termsOfService,
      contact: spec.info.contact,
      license: spec.info.license,
      servers: spec.servers || [],
      tags: this.extractUniqueTags(spec),
      operationStats: {
        total: allOperations.length,
        byMethod: methodCounts,
        methods: Object.keys(methodCounts),
        pathPrefixes: Array.from(pathPrefixes),
        operationIds,
      },
      sampleOperations,
      paths,
      operationSearchText,
      externalDocs: spec.externalDocs,
      s3Location: {
        bucket,
        key: s3Key,
      },
      indexedAt: now,
      updatedAt: now,
      fileSize,
      fileFormat: format,
    };

    return { document, truncated };
  }

  /**
   * Parse and transform an OpenAPI spec from raw content
   */
  parseAndTransform(
    content: string,
    s3Key: string,
    bucket: string,
  ): { document: OpenApiIndexDocument; truncated: boolean } {
    // Check file size
    const fileSize = Buffer.byteLength(content, 'utf8');
    if (fileSize > INDEXING_LIMITS.MAX_FILE_SIZE) {
      throw new IndexingError(
        `File too large: ${fileSize} bytes (max: ${INDEXING_LIMITS.MAX_FILE_SIZE})`,
        IndexingErrorCode.FILE_TOO_LARGE,
        s3Key,
      );
    }

    // Detect format and parse
    const format = this.detectFormat(s3Key);
    const rawSpec = this.parseContent(content, format);

    // Validate OpenAPI 3.x
    this.validateOpenApi3(rawSpec, s3Key);

    // Transform to index document
    return this.transformToIndexDocument(rawSpec, s3Key, bucket, fileSize, format);
  }
}
