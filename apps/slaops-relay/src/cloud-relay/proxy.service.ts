import { Injectable, Logger } from '@nestjs/common'
import { promises as dns } from 'dns'
import { env } from '../env'
import { evaluatePolicy } from '../policy/evaluator'
import { PLATFORM_DEFAULT_POLICY } from '../policy/types'
import type { RequestContext } from '../policy/types'
import { secretStoreRegistry } from '../secrets/secret-store-registry'
import { resolveTemplates, TemplateError } from '../template/template-resolver'
import { maskSecrets } from '../masking/secret-masker'
import type {
  CloudProxyRequestDto,
  TemplateVariableDefinitionDto,
} from './dto/cloud-proxy-request.dto'
import type { CloudProxyResponseDto } from './dto/cloud-proxy-response.dto'

/** Hop-by-hop headers that must never be forwarded to the target. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
  'host',
])

/** RFC 1918 private IPv4 ranges and other non-routable ranges. */
const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
]

const LOOPBACK_RANGES = [/^127\./, /^::1$/]
const LINK_LOCAL_RANGES = [/^169\.254\./, /^fe80:/i]
const MULTICAST_RANGES = [/^22[4-9]\./, /^23\d\./, /^ff/i]

/** Cloud metadata endpoints that must always be blocked. */
const METADATA_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal', '169.254.170.2'])

function testRanges(ip: string, ranges: RegExp[]): boolean {
  return ranges.some((r) => r.test(ip))
}

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => r.test(ip))
}

function isLoopbackIp(ip: string): boolean {
  return testRanges(ip, LOOPBACK_RANGES)
}

function isLinkLocalIp(ip: string): boolean {
  return testRanges(ip, LINK_LOCAL_RANGES)
}

function isMulticastIp(ip: string): boolean {
  return testRanges(ip, MULTICAST_RANGES)
}

function isIpLiteral(host: string): boolean {
  // IPv4 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true
  // IPv6 literal (with or without brackets)
  if (/^\[/.test(host) || /^[0-9a-f:]+$/i.test(host)) return true
  return false
}

function isLocalhostName(host: string): boolean {
  return host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')
}

async function resolveIps(host: string): Promise<string[]> {
  if (isIpLiteral(host)) return [host]
  try {
    const result = await dns.lookup(host, { all: true })
    return result.map((r) => r.address)
  } catch {
    return []
  }
}

function normalizeResponseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, name) => {
    out[name.toLowerCase()] = value
  })
  return out
}

function encodeFormParams(params: Array<{ name: string; value?: string }>): string {
  return params
    .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value ?? '')}`)
    .join('&')
}

function mergeQueryString(
  rawUrl: string,
  queryParams: Array<{ name: string; value: string }>,
): string {
  if (queryParams.length === 0) return rawUrl
  const url = new URL(rawUrl)
  for (const { name, value } of queryParams) {
    url.searchParams.append(name, value)
  }
  return url.toString()
}

function resolveVariables(
  defs: Record<string, TemplateVariableDefinitionDto> | undefined,
): Record<string, string> {
  if (!defs) return {}
  const out: Record<string, string> = {}
  for (const [name, def] of Object.entries(defs)) {
    if (def.type === 'literal' && def.value !== undefined) {
      out[name] = def.value
    } else if (def.type === 'env' && def.envVar) {
      out[name] = process.env[def.envVar] ?? ''
    }
    // 'secret' type variables are resolved during template resolution via {{secret:*}}
  }
  return out
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name)
  private readonly secretStore = secretStoreRegistry.create()

  async proxy(
    dto: CloudProxyRequestDto,
    userId: string,
    tenantId: string,
  ): Promise<CloudProxyResponseDto> {
    const startTime = Date.now()

    // Log immediately so every call is visible regardless of what happens next.
    // URL may still contain unresolved template placeholders at this point.
    this.logger.log(
      JSON.stringify({
        event: 'proxy_request',
        method: dto.request.method,
        url: dto.request.url,
        header_count: dto.request.headers.length,
        body_bytes: dto.request.bodySize >= 0 ? dto.request.bodySize : 0,
        user_id: userId,
        tenant_id: tenantId,
        ...(env.relay.requestDebug
          ? {
              request_headers: Object.fromEntries(
                dto.request.headers.map((h) => [h.name, h.value]),
              ),
              request_body: dto.request.postData?.text?.slice(0, 500) ?? null,
            }
          : {}),
      }),
    )

    // 1. Resolve template expressions in all HAR string fields
    const variables = resolveVariables(dto.templateContext?.variables)
    let har = dto.request
    let injectedSecrets: import('../template/template-resolver').InjectedSecret[] = []

    try {
      const resolved = await resolveTemplates(
        har as unknown as Record<string, unknown>,
        this.secretStore,
        variables,
      )
      har = resolved.value as unknown as typeof har
      injectedSecrets = resolved.injectedSecrets
    } catch (err) {
      if (err instanceof TemplateError) {
        this.logger.warn(
          JSON.stringify({
            event: 'proxy_error',
            reason: 'template_error',
            url: dto.request.url,
            method: dto.request.method,
            user_id: userId,
            tenant_id: tenantId,
            error: err.message,
            duration_ms: Date.now() - startTime,
          }),
        )
        return {
          status: 0,
          statusText: 'Template Error',
          headers: {},
          body: err.message,
          durationMs: Date.now() - startTime,
          requestedAt: new Date(startTime).toISOString(),
        }
      }
      throw err
    }

    // 2. Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(har.url)
    } catch {
      this.logger.warn(
        JSON.stringify({
          event: 'proxy_error',
          reason: 'invalid_url',
          url: har.url,
          method: har.method,
          user_id: userId,
          tenant_id: tenantId,
          duration_ms: Date.now() - startTime,
        }),
      )
      return {
        status: 0,
        statusText: 'Invalid URL',
        headers: {},
        body: `Invalid URL: ${har.url}`,
        durationMs: Date.now() - startTime,
        requestedAt: new Date(startTime).toISOString(),
      }
    }

    if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
      this.logger.warn(
        JSON.stringify({
          event: 'proxy_error',
          reason: 'unsupported_protocol',
          url: har.url,
          method: har.method,
          protocol: parsedUrl.protocol,
          user_id: userId,
          tenant_id: tenantId,
          duration_ms: Date.now() - startTime,
        }),
      )
      return {
        status: 0,
        statusText: 'Invalid URL',
        headers: {},
        body: `Unsupported protocol: ${parsedUrl.protocol}`,
        durationMs: Date.now() - startTime,
        requestedAt: new Date(startTime).toISOString(),
      }
    }

    // 3. Resolve DNS
    const host = parsedUrl.hostname
    const resolvedIps = await resolveIps(host)

    // 4. Compute derived host flags (hard SSRF protections — always enforced)
    const isIp = isIpLiteral(host)
    const isLocalhost = isLocalhostName(host) || METADATA_HOSTS.has(host)
    const isPrivateNetwork = resolvedIps.some(isPrivateIp) || isPrivateIp(host)
    const isLinkLocal = resolvedIps.some(isLinkLocalIp) || isLinkLocalIp(host)
    const isLoopback = resolvedIps.some(isLoopbackIp) || isLoopbackIp(host)
    const isMulticast = resolvedIps.some(isMulticastIp) || isMulticastIp(host)

    // Build request context for policy evaluation
    const ctx: RequestContext = {
      user: { id: userId, authenticated: true, roles: [] },
      tenant: { id: tenantId, plan: 'default', allowlist: [] },
      request: {
        method: har.method,
        headers: Object.fromEntries(har.headers.map((h) => [h.name.toLowerCase(), h.value])),
        bodyBytes: har.bodySize >= 0 ? har.bodySize : 0,
      },
      url: {
        raw: har.url,
        scheme: parsedUrl.protocol.replace(':', ''),
        host,
        port: parsedUrl.port
          ? parseInt(parsedUrl.port, 10)
          : parsedUrl.protocol === 'https:'
            ? 443
            : 80,
        path: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams),
      },
      host: {
        resolvedIps,
        isIp,
        isLocalhost,
        isPrivateNetwork,
        isLinkLocal,
        isLoopback,
        isMulticast,
        inTenantAllowlist: false,
      },
    }

    // 5. Evaluate security policy
    // TODO : make it that if process.env.RELAY_DISABLE_POLICY === 'true' then we allow the policy and have reason : policy_disabled, and print a warning.
    // TODO document all environment variables for relay
    const policyResult = evaluatePolicy(PLATFORM_DEFAULT_POLICY, ctx, env.relay.policyDebug)
    if (!policyResult.allowed) {
      this.logger.warn(
        JSON.stringify({
          event: 'proxy_error',
          reason: 'policy_denied',
          url: har.url,
          method: har.method,
          host,
          resolved_ips: resolvedIps,
          policy_reason: policyResult.reason,
          user_id: userId,
          tenant_id: tenantId,
          duration_ms: Date.now() - startTime,
        }),
      )
      return {
        status: 0,
        statusText: 'Policy Denied',
        headers: {},
        body: policyResult.reason,
        durationMs: Date.now() - startTime,
        requestedAt: new Date(startTime).toISOString(),
      }
    }

    const enforce = policyResult.enforce

    // 6. Merge query string params into URL
    const resolvedUrl = mergeQueryString(har.url, har.queryString)

    // 7. Build headers map and strip hop-by-hop entries
    const rawHeaders = new Headers()
    for (const { name, value } of har.headers) {
      if (!HOP_BY_HOP.has(name.toLowerCase())) {
        rawHeaders.set(name, value)
      }
    }

    // 8. Merge cookies into Cookie header
    if (har.cookies.length > 0) {
      const cookieString = har.cookies.map((c) => `${c.name}=${c.value}`).join('; ')
      rawHeaders.set('Cookie', cookieString)
    }

    // 9. Apply policy-enforced header rules
    if (enforce.stripRequestHeaders) {
      for (const name of enforce.stripRequestHeaders) {
        rawHeaders.delete(name)
      }
    }
    if (enforce.allowRequestHeaders) {
      const allowed = new Set(enforce.allowRequestHeaders.map((h) => h.toLowerCase()))
      for (const name of [...rawHeaders.keys()]) {
        if (!allowed.has(name.toLowerCase())) rawHeaders.delete(name)
      }
    }

    // 10. Resolve body from postData
    let body: string | undefined
    if (har.postData) {
      if (har.postData.text !== undefined) {
        body = har.postData.text
        if (!rawHeaders.has('Content-Type')) {
          rawHeaders.set('Content-Type', har.postData.mimeType)
        }
      } else if (har.postData.params) {
        body = encodeFormParams(har.postData.params)
        rawHeaders.set('Content-Type', 'application/x-www-form-urlencoded')
      }
    }

    // Strip body for methods that should not carry one
    if (['GET', 'HEAD'].includes(har.method) && body !== undefined) {
      body = undefined
    }

    // 11. Execute fetch with timeout
    const effectiveTimeout = enforce.timeoutMs ?? dto.timeoutMs ?? env.relay.proxyTimeoutMs
    const allowRedirects = enforce.allowRedirects ?? false

    let nativeResponse: Response
    try {
      nativeResponse = await fetch(resolvedUrl, {
        method: har.method,
        headers: rawHeaders,
        body: body !== undefined ? body : undefined,
        redirect: allowRedirects ? 'follow' : 'manual',
        signal: AbortSignal.timeout(effectiveTimeout),
      })
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime
      if (err instanceof Error && err.name === 'TimeoutError') {
        return {
          status: 0,
          statusText: 'Timeout',
          headers: {},
          body: 'Request timed out',
          durationMs,
          requestedAt: new Date(startTime).toISOString(),
        }
      }
      return {
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: (err as Error).message ?? 'Network error',
        durationMs,
        requestedAt: new Date(startTime).toISOString(),
      }
    }

    // 12. Read response body
    let responseBody = await nativeResponse.text()
    let responseHeaders = normalizeResponseHeaders(nativeResponse.headers)
    const durationMs = Date.now() - startTime

    // 13. Apply response header allow-list
    if (enforce.allowResponseHeaders) {
      const allowed = new Set(enforce.allowResponseHeaders.map((h) => h.toLowerCase()))
      responseHeaders = Object.fromEntries(
        Object.entries(responseHeaders).filter(([k]) => allowed.has(k)),
      )
    }

    // 14. Enforce max response body size
    const maxBody = enforce.maxResponseBodyBytes ?? env.relay.proxyMaxBodyBytes
    if (Buffer.byteLength(responseBody, 'utf8') > maxBody) {
      responseBody = responseBody.slice(0, maxBody)
      responseHeaders['x-slaops-truncated'] = 'true'
    }

    // 15. Mask injected secret values in response
    const {
      body: maskedBody,
      headers: maskedHeaders,
      masking,
    } = maskSecrets(responseBody, responseHeaders, injectedSecrets)

    this.logger.log(
      JSON.stringify({
        event: 'proxy_response',
        method: har.method,
        url: har.url,
        status: nativeResponse.status,
        status_text: nativeResponse.statusText,
        duration_ms: durationMs,
        response_body_bytes: Buffer.byteLength(maskedBody, 'utf8'),
        truncated: maskedHeaders['x-slaops-truncated'] === 'true',
        secrets_masked: masking.maskedSecretIds.length,
        ...(env.relay.requestDebug
          ? {
              response_headers: maskedHeaders,
              response_body: maskedBody.slice(0, 500),
            }
          : {}),
      }),
    )

    return {
      status: nativeResponse.status,
      statusText: nativeResponse.statusText,
      headers: maskedHeaders,
      body: maskedBody,
      durationMs,
      requestedAt: new Date(startTime).toISOString(),
      ...(masking.maskedSecretIds.length > 0 ? { masking } : {}),
    }
  }
}
