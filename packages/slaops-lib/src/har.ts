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

/** Allows vendor/user-defined extension members beginning with an underscore. */
export type HarExtensions = Record<`_${string}`, unknown>;

/** Root object */
export interface Har extends HarExtensions {
    log: HarLog;
}

/** Top-level log */
export interface HarLog extends HarExtensions {
    /** HAR version string, e.g. "1.2" */
    version: string;
    creator: HarCreator;
    /** Optional browser info */
    browser?: HarBrowser;
    /** Pages in the export (may be empty). */
    pages?: HarPage[];
    /** Entries (HTTP requests) */
    entries: HarEntry[];
    /** Optional comment */
    comment?: string;
}

export interface HarCreator extends HarExtensions {
    /** Name of the log creator application */
    name: string;
    /** Version of the log creator */
    version: string;
    comment?: string;
}

export interface HarBrowser extends HarExtensions {
    name: string;
    version: string;
    comment?: string;
}

export interface HarPage extends HarExtensions {
    /** ISO-8601 timestamp for the page load start */
    startedDateTime: string;
    /** Unique page id that "pageref" in entries can refer to */
    id: string;
    /** Page title */
    title: string;
    /** Various page-level timings */
    pageTimings: HarPageTimings;
    comment?: string;
}

export interface HarPageTimings extends HarExtensions {
    /**
     * Content load time (ms). -1 if unknown.
     * Time from navigationStart to DOMContentLoaded (or equivalent).
     */
    onContentLoad?: number; // may be -1
    /**
     * Page load time (ms). -1 if unknown.
     * Time from navigationStart to load event (or equivalent).
     */
    onLoad?: number; // may be -1
    /**
     * Time spent on any custom metrics; spec allows additional fields starting with "_" via HarExtensions.
     */
    comment?: string;
}

export interface HarEntry extends HarExtensions {
    /**
     * Reference to the parent page (HarPage.id). Optional when not applicable.
     */
    pageref?: string;
    /** Time the request started (ISO-8601). */
    startedDateTime: string;
    /** Total time of the request in ms (sum of timings).* */
    time: number;
    request: HarRequest;
    response: HarResponse;
    cache?: HarCache;
    timings: HarTimings;
    /** Server IP address (IPv4/IPv6 as string). */
    serverIPAddress?: string;
    /** Connection id (e.g., TCP connection id). */
    connection?: string;
    /**
     * If true, indicates this entry was blocked by a security policy (e.g., CORS). Non-standard extension
     * sometimes used by tools; keep as optional for compatibility.
     */
    blocked?: boolean;
    comment?: string;
}

export interface HarRequest extends HarExtensions {
    /** HTTP method (e.g., GET, POST, …) */
    method: string;
    /** Absolute URL of the request */
    url: string;
    /** e.g., "HTTP/1.1", "h2" */
    httpVersion: string;
    cookies: HarCookie[];
    headers: HarHeader[];
    /** Query parameters extracted from URL */
    queryString: HarQueryString[];
    /** Optional posted data */
    postData?: HarPostData;
    /** Total size of request headers in bytes, or -1 if unknown */
    headersSize: number;
    /** Size of the request body in bytes, or -1 if unknown */
    bodySize: number;
    comment?: string;
}

export interface HarResponse extends HarExtensions {
    /** HTTP status code */
    status: number;
    /** HTTP status text */
    statusText: string;
    /** e.g., "HTTP/1.1", "h2" */
    httpVersion: string;
    cookies: HarCookie[];
    headers: HarHeader[];
    content: HarContent;
    /**
     * Redirection target URL from the Location response header (if present), else empty string per spec.
     */
    redirectURL: string;
    /** Total size of response headers in bytes, or -1 if unknown */
    headersSize: number;
    /** Size of the response body in bytes, or -1 if unknown */
    bodySize: number;
    comment?: string;
}

export interface HarCookie extends HarExtensions {
    name: string;
    value: string;
    path?: string;
    domain?: string;
    /** Expires as ISO-8601 date-time string or null if session cookie */
    expires?: string | null;
    httpOnly?: boolean;
    secure?: boolean;
    /** SameSite is not formally part of HAR 1.2 but some tools include it */
    sameSite?: "Strict" | "Lax" | "None" | string;
    comment?: string;
}

export interface HarHeader extends HarExtensions {
    name: string;
    value: string;
    comment?: string;
}

export interface HarQueryString extends HarExtensions {
    name: string;
    value: string;
    comment?: string;
}

export interface HarPostData extends HarExtensions {
    /** MIME type of posted data (e.g., application/json, application/x-www-form-urlencoded) */
    mimeType: string;
    /** Parsed form parameters if applicable */
    params?: HarPostParam[];
    /** The raw request body (text). Tools may also put Base64 here with encoding noted in content/encoding elsewhere. */
    text?: string;
    comment?: string;
}

export interface HarPostParam extends HarExtensions {
    name: string;
    value?: string;
    fileName?: string;
    contentType?: string;
    comment?: string;
}

export interface HarContent extends HarExtensions {
    /** Length of the returned content in bytes (after decoding). */
    size: number;
    /**
     * Compression saved (size before - size after). Absent if unknown.
     */
    compression?: number;
    /** MIME type, e.g., text/html; charset=utf-8 */
    mimeType: string;
    /**
     * Response body as a string. Text may be plain or, if encoding is present, Base64.
     */
    text?: string;
    /** If present, typically "base64" to indicate text is Base64-encoded. */
    encoding?: string;
    comment?: string;
}

export interface HarCache extends HarExtensions {
    beforeRequest?: HarCacheState;
    afterRequest?: HarCacheState;
    comment?: string;
}

export interface HarCacheState extends HarExtensions {
    /** ISO-8601 expiration time for the cached entry */
    expires?: string | null;
    /** ISO-8601 last access time */
    lastAccess: string;
    /** Entity tag */
    eTag: string;
    /** Number of times the entry has been used */
    hitCount: number;
    comment?: string;
}

export interface HarTimings extends HarExtensions {
    /** Waiting for a network connection (ms). */
    blocked?: number; // may be -1
    /** DNS resolution time (ms). */
    dns?: number; // may be -1
    /** TCP connect time (ms). */
    connect?: number; // may be -1
    /** TLS/SSL handshake time (ms). */
    ssl?: number; // may be -1
    /** Time to send request (ms). */
    send: number;
    /** Time waiting for a response (ms). */
    wait: number;
    /** Time to receive response data (ms). */
    receive: number;
    comment?: string;
}

// Convenient alias commonly used by consumers
export type HAR = Har;
