/*
 * TypeScript types for the HAR 1.2 specification
 * Spec: https://w3c.github.io/web-performance/specs/HAR/Overview.html
 *
 * Notes
 * - All timestamps are ISO-8601 strings per spec (e.g., 2009-04-16T12:07:25.123+01:00)
 * - Sizes like headersSize/bodySize may be -1 to indicate "unknown" per spec
 * - Custom (non-standard) fields are allowed if they begin with "_". We model this via the HarExtensions
 *   mapped type and intersect it into each object interface.
 */

import { RawRequest, RawResponse } from '../types'

/** Listener for a HAR log */
export type HarLogListener = (logs: HarEntry[]) => Promise<void>

/** Allows vendor/user-defined extension members beginning with an underscore. */
export type HarExtensions = Record<`_${string}`, unknown>

/** Root object */
export interface Har extends HarExtensions {
  log: HarLog
}

/** Top-level log */
export interface HarLog extends HarExtensions {
  /** HAR version string, e.g. "1.2" */
  version: string
  creator: HarCreator
  /** Optional browser info */
  browser?: HarBrowser
  /** Pages in the export (may be empty). */
  pages?: HarPage[]
  /** Entries (HTTP requests) */
  entries: HarEntry[]
  /** Optional comment */
  comment?: string
}

export interface HarCreator extends HarExtensions {
  /** Name of the log creator application */
  name: string
  /** Version of the log creator */
  version: string
  comment?: string
}

export interface HarBrowser extends HarExtensions {
  name: string
  version: string
  comment?: string
}

export interface HarPage extends HarExtensions {
  /** ISO-8601 timestamp for the page load start */
  startedDateTime: string
  /** Unique page id that "pageref" in entries can refer to */
  id: string
  /** Page title */
  title: string
  /** Various page-level timings */
  pageTimings: HarPageTimings
  comment?: string
}

export interface HarPageTimings extends HarExtensions {
  /**
   * Content load time (ms). -1 if unknown.
   * Time from navigationStart to DOMContentLoaded (or equivalent).
   */
  onContentLoad?: number // may be -1
  /**
   * Page load time (ms). -1 if unknown.
   * Time from navigationStart to load event (or equivalent).
   */
  onLoad?: number // may be -1
  /**
   * Time spent on any custom metrics; spec allows additional fields starting with "_" via HarExtensions.
   */
  comment?: string
}

export interface HarEntry extends HarExtensions {
  /**
   * Reference to the parent page (HarPage.id). Optional when not applicable.
   */
  pageref?: string
  /** Time the request started (ISO-8601). */
  startedDateTime: string
  /** Total time of the request in ms (sum of timings).* */
  time: number
  request: HarRequest
  response: HarResponse
  cache?: HarCache
  timings?: HarTimings
  /** Server IP address (IPv4/IPv6 as string). */
  serverIPAddress?: string
  /** Connection id (e.g., TCP connection id). */
  connection?: string
  /**
   * If true, indicates this entry was blocked by a security policy (e.g., CORS). Non-standard extension
   * sometimes used by tools; keep as optional for compatibility.
   */
  blocked?: boolean
  comment?: string
}

export interface HarRequest extends HarExtensions {
  /** HTTP method (e.g., GET, POST, …) */
  method: string
  /** Absolute URL of the request */
  url: string
  /** e.g., "HTTP/1.1", "h2" */
  httpVersion: string
  cookies: HarCookie[]
  headers: HarHeader[]
  /** Query parameters extracted from URL */
  queryString: HarQueryString[]
  /** Optional posted data */
  postData?: HarPostData
  /** Total size of request headers in bytes, or -1 if unknown */
  headersSize: number
  /** Size of the request body in bytes, or -1 if unknown */
  bodySize: number
  comment?: string
}

export interface HarResponse extends HarExtensions {
  /** HTTP status code */
  status: number
  /** HTTP status text */
  statusText: string
  /** e.g., "HTTP/1.1", "h2" */
  httpVersion: string
  cookies: HarCookie[]
  headers: HarHeader[]
  content: HarContent
  /**
   * Redirection target URL from the Location response header (if present), else empty string per spec.
   */
  redirectURL: string
  /** Total size of response headers in bytes, or -1 if unknown */
  headersSize: number
  /** Size of the response body in bytes, or -1 if unknown */
  bodySize: number
  comment?: string
}

export interface HarCookie extends HarExtensions {
  name: string
  value: string
  path?: string
  domain?: string
  /** Expires as ISO-8601 date-time string or null if session cookie */
  expires?: string | null
  httpOnly?: boolean
  secure?: boolean
  /** SameSite is not formally part of HAR 1.2 but some tools include it */
  sameSite?: 'Strict' | 'Lax' | 'None' | string
  comment?: string
}

export interface HarHeader extends HarExtensions {
  name: string
  value: string
  comment?: string
}

export interface HarQueryString extends HarExtensions {
  name: string
  value: string
  comment?: string
}

export interface HarPostData extends HarExtensions {
  /** MIME type of posted data (e.g., application/json, application/x-www-form-urlencoded) */
  mimeType: string
  /** Parsed form parameters if applicable */
  params?: HarPostParam[]
  /** The raw request body (text). Tools may also put Base64 here with encoding noted in content/encoding elsewhere. */
  text?: string
  comment?: string
}

export interface HarPostParam extends HarExtensions {
  name: string
  value?: string
  fileName?: string
  contentType?: string
  comment?: string
}

export interface HarContent extends HarExtensions {
  /** Length of the returned content in bytes (after decoding). */
  size: number
  /**
   * Compression saved (size before - size after). Absent if unknown.
   */
  compression?: number
  /** MIME type, e.g., text/html; charset=utf-8 */
  mimeType: string
  /**
   * Response body as a string. Text may be plain or, if encoding is present, Base64.
   */
  text?: string
  /** If present, typically "base64" to indicate text is Base64-encoded. */
  encoding?: string
  comment?: string
}

export interface HarCache extends HarExtensions {
  beforeRequest?: HarCacheState
  afterRequest?: HarCacheState
  comment?: string
}

export interface HarCacheState extends HarExtensions {
  /** ISO-8601 expiration time for the cached entry */
  expires?: string | null
  /** ISO-8601 last access time */
  lastAccess: string
  /** Entity tag */
  eTag: string
  /** Number of times the entry has been used */
  hitCount: number
  comment?: string
}

export interface HarTimings extends HarExtensions {
  /** Waiting for a network connection (ms). */
  blocked?: number // may be -1
  /** DNS resolution time (ms). */
  dns?: number // may be -1
  /** TCP connect time (ms). */
  connect?: number // may be -1
  /** TLS/SSL handshake time (ms). */
  ssl?: number // may be -1
  /** Time to send request (ms). */
  send: number
  /** Time waiting for a response (ms). */
  wait: number
  /** Time to receive response data (ms). */
  receive: number
  comment?: string
}

// Convenient alias commonly used by consumers
export type HAR = Har

/**
 * Creates a complete HAR log from request and response data.
 * This is the main entry point for HAR generation.
 */
export function createHarLog(request: RawRequest, response: RawResponse): HarLog {
  return {
    version: '1.2',
    creator: {
      name: 'SLAOps',
      version: '1.0.0',
    },
    entries: [createHarEntry(request, response)],
  }
}

/**
 * Creates a HAR entry (single HTTP transaction) from request and response.
 */
function createHarEntry(request: RawRequest, response: RawResponse): HarEntry {
  // Use provided timestamp or current time
  const startedDateTime = request.startedDateTime
    ? typeof request.startedDateTime === 'string'
      ? request.startedDateTime
      : request.startedDateTime.toISOString()
    : new Date().toISOString()

  // Calculate total time if available
  const time = request.time ?? 0

  // Create timings object if timing data is available
  const timings = request.timings ? createHarTimings(request.timings) : undefined

  return {
    startedDateTime,
    time,
    request: createHarRequest(request),
    response: createHarResponse(response),
    cache: undefined, // Could be enhanced with cache information
    timings,
    serverIPAddress: request.serverIPAddress,
    connection: request.connection,
    blocked: false,
    comment: undefined,
  }
}

/**
 * Creates HAR timings from timing data.
 */
function createHarTimings(timings: NonNullable<RawRequest['timings']>): HarTimings {
  return {
    blocked: timings.blocked ?? -1,
    dns: timings.dns ?? -1,
    connect: timings.connect ?? -1,
    ssl: timings.ssl ?? -1,
    send: timings.send ?? 0,
    wait: timings.wait ?? 0,
    receive: timings.receive ?? 0,
  }
}
/**
 * Creates HAR request from RawRequest.
 */
function createHarRequest(request: RawRequest): HarRequest {
  // Convert headers to HAR format
  const headers: HarHeader[] = Object.entries(request.headers ?? {}).map(([key, value]) => ({
    name: key,
    value: Array.isArray(value) ? value.join(', ') : String(value),
  }))

  // Parse cookies from request.cookies or Cookie header
  const cookies: HarCookie[] = request.cookies
    ? request.cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        path: cookie.path,
        domain: cookie.domain,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      }))
    : parseCookiesFromHeader(request.headers?.['cookie'] ?? request.headers?.['Cookie'])

  // Parse query string from queryParams or URL
  const queryString: HarQueryString[] = parseQueryString(request)

  // Create post data if body exists
  const postData = createPostData(request)

  // Calculate sizes
  const headersSize = calculateHeadersSize(headers)
  const bodySize = calculateBodySize(request.body)

  return {
    method: request.method,
    url: request.url.href,
    httpVersion: request.httpVersion ?? 'HTTP/1.1',
    cookies,
    headers,
    queryString,
    postData,
    headersSize,
    bodySize,
  }
}

function normalizeHarContent(response: RawResponse): HarContent {
  const { body, encoding, size, compression, mimeType } = response

  let text: string | undefined

  if (body !== undefined && body !== null) {
    if (typeof body === 'string') {
      text = body
    } else if (typeof body === 'object') {
      const globalBuffer = (
        globalThis as unknown as { Buffer?: { isBuffer(value: unknown): boolean } }
      ).Buffer
      if (globalBuffer?.isBuffer?.(body)) {
        text = (body as { toString: (encoding?: string) => string }).toString()
      } else {
        try {
          text = JSON.stringify(body)
        } catch {
          text = String(body)
        }
      }
    } else {
      text = String(body)
    }
  }

  return {
    size,
    compression,
    mimeType,
    text,
    encoding,
  }
}

/**
 * Creates HAR response from RawResponse.
 */
function createHarResponse(response: RawResponse): HarResponse {
  // Convert headers to HAR format
  const headers: HarHeader[] = Object.entries(response.headers ?? {}).map(([key, value]) => ({
    name: key,
    value: Array.isArray(value) ? value.join(', ') : String(value),
  }))

  // Parse cookies from response.cookies or Set-Cookie headers
  const cookies: HarCookie[] = response.cookies
    ? response.cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        path: cookie.path,
        domain: cookie.domain,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      }))
    : parseSetCookiesFromHeaders(response.headers)

  // Get redirect URL from Location header or response field
  const redirectURL =
    response.redirectURL ?? response.headers?.['location'] ?? response.headers?.['Location'] ?? ''

  // Calculate sizes
  const headersSize = calculateHeadersSize(headers)
  const bodySize = response.size ?? calculateBodySize(response.body)

  return {
    status: response.status,
    statusText: response.statusText,
    httpVersion: response.httpVersion ?? 'HTTP/1.1',
    cookies,
    headers,
    content: normalizeHarContent(response),
    redirectURL: String(redirectURL),
    headersSize,
    bodySize,
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parses cookies from a Cookie header string.
 * Format: "name1=value1; name2=value2"
 */
function parseCookiesFromHeader(cookieHeader: string | string[] | undefined): HarCookie[] {
  if (!cookieHeader) return []

  const cookieString = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader
  const cookies: HarCookie[] = []

  // Split by semicolon and parse each cookie
  const parts = cookieString.split(';').map((s) => s.trim())
  for (const part of parts) {
    const [name, ...valueParts] = part.split('=')
    if (name) {
      cookies.push({
        name: name.trim(),
        value: valueParts.join('=').trim(),
      })
    }
  }

  return cookies
}

/**
 * Parses Set-Cookie headers from response headers.
 * Each Set-Cookie header can contain a single cookie with attributes.
 */
function parseSetCookiesFromHeaders(headers?: Record<string, any>): HarCookie[] {
  if (!headers) return []

  const setCookieHeaders = headers['set-cookie'] ?? headers['Set-Cookie']
  if (!setCookieHeaders) return []

  const headerArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
  const cookies: HarCookie[] = []

  for (const header of headerArray) {
    const cookie = parseSetCookie(String(header))
    if (cookie) {
      cookies.push(cookie)
    }
  }

  return cookies
}

/**
 * Parses a single Set-Cookie header value.
 * Format: "name=value; Path=/; Domain=example.com; Secure; HttpOnly; SameSite=Strict"
 */
function parseSetCookie(setCookieValue: string): HarCookie | null {
  const parts = setCookieValue.split(';').map((s) => s.trim())
  if (parts.length === 0 || !parts[0]) return null

  // First part is always name=value
  const [name, ...valueParts] = parts[0].split('=')
  if (!name) return null

  const cookie: HarCookie = {
    name: name.trim(),
    value: valueParts.join('=').trim(),
  }

  // Parse attributes
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue

    const [attrName, attrValue] = part.split('=').map((s) => s?.trim() ?? '')
    if (!attrName) continue

    const lowerAttrName = attrName.toLowerCase()

    switch (lowerAttrName) {
      case 'path':
        cookie.path = attrValue
        break
      case 'domain':
        cookie.domain = attrValue
        break
      case 'expires':
        cookie.expires = attrValue
        break
      case 'httponly':
        cookie.httpOnly = true
        break
      case 'secure':
        cookie.secure = true
        break
      case 'samesite':
        cookie.sameSite = attrValue as any
        break
    }
  }

  return cookie
}

/**
 * Parses query string parameters from request.
 * Prioritizes queryParams field, falls back to parsing URL search string.
 */
function parseQueryString(request: RawRequest): HarQueryString[] {
  // Use queryParams if available
  if (request.queryParams) {
    return Object.entries(request.queryParams).flatMap(([name, value]) => {
      if (Array.isArray(value)) {
        return value.map((v) => ({ name, value: String(v) }))
      }
      return [{ name, value: String(value) }]
    })
  }

  // Parse from URL search string
  const searchString = request.url.search
  if (!searchString) return []

  const params: HarQueryString[] = []
  const urlParams = new URLSearchParams(searchString)
  urlParams.forEach((value, name) => {
    params.push({ name, value })
  })

  return params
}

/**
 * Creates HAR post data from request body.
 */
function createPostData(request: RawRequest): HarPostData | undefined {
  if (!request.body) return undefined

  // Determine MIME type from Content-Type header
  const contentType = request.headers?.['content-type'] ?? request.headers?.['Content-Type']
  const mimeType =
    typeof contentType === 'string'
      ? (contentType.split(';')[0] ?? 'application/octet-stream').trim()
      : 'application/octet-stream'

  const postData: HarPostData = {
    mimeType,
  }

  // Handle form data
  if (mimeType === 'application/x-www-form-urlencoded' && request.bodyParams) {
    postData.params = Object.entries(request.bodyParams).map(([name, value]) => ({
      name,
      value: String(value),
    }))
  } else if (mimeType === 'multipart/form-data' && request.bodyParams) {
    postData.params = Object.entries(request.bodyParams).map(([name, value]) => ({
      name,
      value: typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value),
    }))
  }

  // Convert body to text
  if (typeof request.body === 'string') {
    postData.text = request.body
  } else if (typeof request.body === 'object') {
    const globalBuffer = (
      globalThis as unknown as { Buffer?: { isBuffer(value: unknown): boolean } }
    ).Buffer
    if (globalBuffer?.isBuffer?.(request.body)) {
      postData.text = (request.body as { toString: (encoding?: string) => string }).toString()
    } else {
      try {
        postData.text = JSON.stringify(request.body)
      } catch {
        postData.text = String(request.body)
      }
    }
  } else {
    postData.text = String(request.body)
  }

  return postData
}

/**
 * Calculates the size of headers in bytes.
 * Approximates HTTP header format: "Name: Value\r\n"
 */
function calculateHeadersSize(headers: HarHeader[]): number {
  if (headers.length === 0) return -1

  let size = 0
  for (const header of headers) {
    // Format: "Name: Value\r\n"
    size += header.name.length + 2 + header.value.length + 2 // +2 for ": " and +2 for "\r\n"
  }
  return size
}

/**
 * Calculates the size of a body in bytes.
 */
function calculateBodySize(body: any): number {
  if (body === undefined || body === null) return 0

  if (typeof body === 'string') {
    return Buffer.byteLength(body, 'utf8')
  }

  if (typeof body === 'object') {
    const globalBuffer = (
      globalThis as unknown as { Buffer?: { isBuffer(value: unknown): boolean } }
    ).Buffer
    if (globalBuffer?.isBuffer?.(body)) {
      return (body as { length: number }).length
    }

    try {
      return Buffer.byteLength(JSON.stringify(body), 'utf8')
    } catch {
      return -1
    }
  }

  return -1
}
