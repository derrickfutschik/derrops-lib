/**
 * Types for the OpenAPI Indexer Lambda function
 */

/**
 * Represents the indexed metadata for an OpenAPI specification
 * This is the document schema stored in OpenSearch
 */
export interface OpenApiIndexDocument {
  /** Unique identifier: {provider}/{service}/{version} */
  id: string;

  /** Provider/domain name (e.g., 'github.com', 'stripe.com') */
  provider: string;

  /** Service name within the provider */
  serviceName: string;

  /** API version string */
  version: string;

  /** OpenAPI specification version (e.g., '3.0.3', '3.1.0') */
  specVersion: string;

  /** API title from info.title */
  title: string;

  /** API description from info.description */
  description: string;

  /** Terms of service URL */
  termsOfService?: string;

  /** Contact information */
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };

  /** License information */
  license?: {
    name: string;
    url?: string;
  };

  /** Server URLs and descriptions */
  servers: Array<{
    url: string;
    description?: string;
  }>;

  /** All unique tags used in the spec (from top-level and operations) */
  tags: string[];

  /** Aggregated operation statistics (not full operation list) */
  operationStats: {
    /** Total number of operations */
    total: number;
    /** Count by HTTP method */
    byMethod: Record<string, number>;
    /** Unique HTTP methods used */
    methods: string[];
    /** Unique path prefixes (first segment, e.g., '/users', '/orders') */
    pathPrefixes: string[];
    /** All unique operationIds (for exact lookup, max 500) */
    operationIds: string[];
  };

  /** Sample operations for display (max 20) */
  sampleOperations: Array<{
    method: string;
    path: string;
    operationId?: string;
    summary?: string;
  }>;

  /** All unique top-level paths (max 100, truncated for large APIs) */
  paths: string[];

  /** Concatenated searchable text from all operation summaries/descriptions */
  operationSearchText: string;

  /** External documentation links */
  externalDocs?: {
    url: string;
    description?: string;
  };

  /** S3 location of the original spec file */
  s3Location: {
    bucket: string;
    key: string;
  };

  /** Metadata */
  indexedAt: string;
  updatedAt: string;
  fileSize: number;
  fileFormat: 'yaml' | 'json';
}

/**
 * Result of indexing a single OpenAPI spec
 */
export interface IndexResult {
  success: boolean;
  documentId: string;
  s3Key: string;
  operationCount: number;
  pathCount: number;
  truncated: boolean;
  error?: string;
  duration: number;
}

/**
 * Indexing error codes
 */
export const IndexingErrorCode = {
  PARSE_ERROR: 'PARSE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  S3_ERROR: 'S3_ERROR',
  OPENSEARCH_ERROR: 'OPENSEARCH_ERROR',
  INVALID_PATH: 'INVALID_PATH',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  NOT_OPENAPI_3: 'NOT_OPENAPI_3',
} as const;

export type IndexingErrorCode = (typeof IndexingErrorCode)[keyof typeof IndexingErrorCode];

/**
 * Custom error class for indexing failures
 */
export class IndexingError extends Error {
  constructor(
    message: string,
    public readonly code: IndexingErrorCode,
    public readonly s3Key: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'IndexingError';
  }
}

/**
 * Limits for dimensionality reduction
 */
export const INDEXING_LIMITS = {
  MAX_PATHS: 100,
  MAX_SAMPLE_OPERATIONS: 20,
  MAX_OPERATION_IDS: 500,
  MAX_SEARCH_TEXT_LENGTH: 50000, // 50KB
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
} as const;
