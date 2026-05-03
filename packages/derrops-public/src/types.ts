/**
 *
 * TODO
 *
 * Each field which is derived from part of the request should be clearly indicated, such as from the request, from the response, from the request and response.
 * From the API etc.
 *
 *
 * Need to have the type for the RAW logs in S3, plus the Enriched logs in Opensearch.
 *
 * What is need to be calculated at log time needs to be derived based on what fields require the request and the response.
 *
 * May need all calculations to be done by the connector SDK as if the body is needed, this will be required.
 *
 *
 *
 */

export type RawConfig = {}

export type RawRequest = {
  method: string
  pathParams?: {
    [k: string]: any
  }
  queryParams?: {
    [k: string]: any
  }
  bodyParams?: {
    [k: string]: any
  }
  headers?: {
    [k: string]: any
  }
  body?: any
  url: {
    href: string
    pathname: string
    host: string
    origin: string
    search?: string
  }
  httpVersion?: string
  /** Timestamp when the request started (ISO-8601 string or Date) */
  startedDateTime?: string | Date
  /** Total request time in milliseconds */
  time?: number
  /** Detailed timing information */
  timings?: {
    blocked?: number
    dns?: number
    connect?: number
    ssl?: number
    send?: number
    wait?: number
    receive?: number
  }
  /** Cookies sent with the request */
  cookies?: Array<{
    name: string
    value: string
    path?: string
    domain?: string
    expires?: string | null
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None' | string
  }>
  /** Server IP address */
  serverIPAddress?: string
  /** Connection identifier */
  connection?: string
}

export type RawResponse = {
  status: number
  statusText: string
  headers?: {
    [k: string]: any
  }
  body?: any
  httpVersion?: string

  size: number
  /**
   * Compression saved (size before - size after). Absent if unknown.
   */
  compression?: number
  /** MIME type, e.g., text/html; charset=utf-8 */
  mimeType: string
  /** If present, typically "base64" to indicate text is Base64-encoded. */
  encoding?: string

  /** Cookies set by the response */
  cookies?: Array<{
    name: string
    value: string
    path?: string
    domain?: string
    expires?: string | null
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None' | string
  }>
  /** Redirect URL from Location header */
  redirectURL?: string
}

export type HttpInfo = {
  /** Size of the body in bytes */
  bodySize: number

  truncation: 'TEXT' | 'JSON' | 'BINARY' | 'NONE'

  /** Hash of the body*/
  bodyHash: string

  /** Hash of the path*/
  pathHash: string

  /** Hash of the query params*/
  queryParamsHash: string

  /** Time of creation*/
  createdAt: number

  /** Unique identifier*/
  id: string

  /** Location of the log if it exists in S3 */
  s3Uri?: string

  /** IPAddress if visible */
  ipAddress: string

  /** TLS Version if visible */
  tlsVersion: string
  /** Cipher if visible */
  cipher: string
  /** Content Type if visible */
  contentType: string
  /** Content Encoding if visible */
  contentEncoding: string
  /** Charset if visible */
  charset: string

  compression: string
  transferEncoding: string
  /** Transfer Encoding if visible */
}

export type RawRequestInfo = HttpInfo & {
  retryCount: number
  originalRequestId: string
}

/** General Information about the Log */
export type DerropsCommon = {
  /** The version of Derrops Used to Index the Log */
  derropsVersion: string
  /** The time the log was indexed */
  indexedAt: number
  /** The latency of the index operation */
  indexLatency: number
}

/** OpenTelemetry Context */
export type OpenTelemetryInfo = {
  /** The trace id */
  traceId: string
  /** The span id */
  spanId: string
  /** The parent span id */
  parentSpanId: string
  /** The trace flags */
  traceFlags: string
  /** The trace state */
  traceState: string
}

export type SLAInfo = {
  /** The SLA of the operation */
  maxLatency: number
  /** The latency of the request */
  latency: number
  /** SLA - Duration */
  slack: number
  /** The availability of the request */
  available: boolean
}

// 6) Cache (align with RFC 9211 “Cache-Status” semantics)

// Keep your enum, but add: cacheKey, cacheLayer (edge/origin/app), revalidated?: boolean, ageMs, staleWhileRevalidateMs, staleIfErrorMs, cacheStatus?: string (raw header for audits).

/** Cache Information aligning with 9211 RFC Cache-Status semantics */
export type CacheInfo = {
  /** Was this a miss or hit */
  hit: 'HIT' | 'MISS' | 'EXPIRED' | 'ERROR' | 'NOT_SURE'
  /** Was this a stale or fresh cache */
  stale: 'STALE' | 'FRESH'
  /** The TTL of the cache */
  ttl: number
  /** The max TTL of the cache */
  maxTtl: number
  /** The sMax TTL of the cache */
  sMaxTtl: number
  /** The eTag of the cache */
  eTag: string
  /** The cache control of the cache */
  cacheControl: string
  /** The max age of the cache */
  cacheControlMaxAge: number
}

export type AWSInfo = {
  /** The cloudfront id */
  cloudfrontId: string
  /** The request id */
  requestId: string
  /** The apigw id */
  apigwId: string
  /** The region */
  region: string
  /** The account id */
  accountId: string
  /** The user id */
  userId: string
  /** The user ARN */
  userArn: string
  /** The X-Ray trace id */
  awsXRayTraceId: string
  /** The name of the AWS Service (Could be a shadow field) */
  serviceName: string
  /** AWS API Operation */
  apiOperation: string
  /** AWS SDK Version */
  awsSdkVersion: string
  /** AWS VPC Endpoint being used for request*/
  vpcEndpointId: string
}

export type OpenAPIMatchInfo = {
  /** The title of the OpenAPI */
  title: string
  /** The version of the OpenAPI */
  version: {
    value: string
    major: number
    minor: number
    patch: number
  }
  /** The operation id */
  operationId: string
  /** The path of the operation */
  path: string
  /** The method of the operation */
  method: string
}

export type JSONSchemaValidationInfo = {
  /** The invalid query params */
  invalidParams: string[]
  bodyValid: boolean
  queryValid: boolean
  pathValid: boolean
}

/** Client Information i.e. the agent which made the call*/
export type ClientInfo = {
  /** The name of the client */
  name: string
  /** Version of the client */
  version: string
  /** The platform of the client */
  platform: string
  /** The architecture of the client */
  architecture: string
  /** The user agent of the client */
  userAgent: string
  /** The IP Address of the client */
  ipAddress: string
}

export type ServerInfo = {
  /** The name of the server */
  name: string
  /** Version of the server */
  version: string
  /** The platform of the server */
  platform: string
}

export type ErrorInfo = {
  /** The type of the error */
  type: string
  /** The title of the error */
  title: string
  /** The status of the error */
  status: number
  /** The detail of the error */
  detail: string
  /** Instance of the error */
  instance?: string
  /** The stack trace of the error */
  extensions?: Record<string, unknown>
  /** The retry count of the error */
  retryCount: number
  /** The original request id of the error */
  originalRequestId: string
}

export type BuildInfo = {
  /** The name of the service */
  service: string
  /** The commit of the application */
  commit: string
  /** The build reference of the application */
  build: string
  /** The deployment reference of the application */
  deployment: string
}

/** JSON Statistics */
export type JSONStats = {
  depth: string
  keys: number
}

/** Authentication Context Such as from a JWT */
export type AuthInfo = {
  userId: string
  username: string
  iat: string
  exp: string
  /** The token type */
  tokenType: string
  /** The scope of the token */
  scope: string
  /** The audience of the token */
  aud: string
  /** The issuer of the token */
  iss: string
  /** the tenant id */
  tenantId: string
}

/** SAAS Information */
export type SAASInfo = {
  /** The ID of the SAAS company */
  id: string

  /** The name of the SAAS company */
  name: string

  /** Website of the SAAS company */
  website: string
}

/** Derrops Information */
export type DerropsInfo = SLAInfo & {
  /** Cache Information */
  cache: CacheInfo

  /** AWS Information */
  aws: AWSInfo

  /** OpenAPI Information */
  openapi: OpenAPIMatchInfo

  /** Client Information */
  clientInfo: ClientInfo

  /** Server Information */
  server: ServerInfo

  /** RFC 7807 Error Information */
  error?: ErrorInfo

  /** Authentication Information */
  auth?: AuthInfo
}

/** Main Data Structure for the Derrops Log */
export type DerropsEnrichedLog = {
  /** General Information */
  common: DerropsCommon

  /** Request Information */
  request: {
    raw: RawRequest
    info: RawRequestInfo
    /** The validation of the API  */
    jsonSchema: JSONSchemaValidationInfo
  }

  /** Response Information */
  response: {
    raw: RawResponse
    info: HttpInfo
    /** The validation of the API  */
    jsonSchema: JSONSchemaValidationInfo
  }

  /** Derrops Information */
  derrops: DerropsInfo
}
