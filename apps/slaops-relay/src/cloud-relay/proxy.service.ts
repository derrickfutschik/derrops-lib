import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { promises as dns } from 'dns'
import { env } from '../env'
import { evaluatePolicy } from '../policy/evaluator'
import { PLATFORM_DEFAULT_POLICY } from '../policy/types'
import type { PolicyResult, RequestContext } from '../policy/types'
import { secretStoreRegistry } from '../secrets/secret-store-registry'
import type { SecretLogger } from '../secrets/secret-store-registry'
import { SecretStoreError } from '../secrets/secret-store'
import { resolveTemplates, TemplateError } from '../template/template-resolver'
import type { InjectedSecret } from '../template/template-resolver'
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

/**
 * Pre-resolve templateContext.variables into a flat string map.
 * - literal: returned as-is
 * - env: read from process.env
 * - secret: resolved via the registry using the full secretUri
 *
 * Secrets resolved here are tracked in injectedFromVars for response masking.
 * SecretStoreErrors are converted to TemplateErrors for consistent error handling.
 */
async function resolveVariables(
  defs: Record<string, TemplateVariableDefinitionDto> | undefined,
  jobId: string,
  logger: SecretLogger,
): Promise<{ variables: Record<string, string>; injectedFromVars: InjectedSecret[] }> {
  if (!defs) return { variables: {}, injectedFromVars: [] }

  const variables: Record<string, string> = {}
  const injectedFromVars: InjectedSecret[] = []

  for (const [name, def] of Object.entries(defs)) {
    if (def.type === 'literal' && def.value !== undefined) {
      variables[name] = def.value
    } else if (def.type === 'env' && def.envVar) {
      variables[name] = process.env[def.envVar] ?? ''
    } else if (def.type === 'secret' && def.secretUri) {
      try {
        const result = await secretStoreRegistry.resolve(def.secretUri, jobId, logger)
        variables[name] = result.value
        injectedFromVars.push({ uri: def.secretUri, value: result.value })
      } catch (err) {
        if (err instanceof SecretStoreError) {
          throw new TemplateError(
            `Failed to resolve variable '${name}' from secret '${def.secretUri}': ${err.message}`,
            def.secretUri,
          )
        }
        throw err
      }
    }
  }

  return { variables, injectedFromVars }
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name)

  /** Adapt NestJS Logger to the SecretLogger interface expected by the registry. */
  private makeSecretLogger(jobId: string): SecretLogger {
    return {
      debug: (obj: object) => this.logger.debug(JSON.stringify({ ...obj, job_id: jobId })),
      info: (obj: object) => this.logger.log(JSON.stringify({ ...obj, job_id: jobId })),
      warn: (obj: object) => this.logger.warn(JSON.stringify({ ...obj, job_id: jobId })),
      error: (obj: object) => this.logger.error(JSON.stringify({ ...obj, job_id: jobId })),
    }
  }

  async proxy(
    dto: CloudProxyRequestDto,
    userId: string,
    tenantId: string,
  ): Promise<CloudProxyResponseDto> {
    const startTime = Date.now()
    // Stable correlation ID for all secret-injection log events in this request.
    const jobId = randomUUID()

    // Log immediately so every call is visible regardless of what happens next.
    // URL may still contain unresolved template placeholders at this point.
    this.logger.log(
      JSON.stringify({
        event: 'proxy_request',
        job_id: jobId,
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

    const secretLogger = this.makeSecretLogger(jobId)

    // 1. Resolve template expressions in all HAR string fields
    let har = dto.request
    let injectedSecrets: InjectedSecret[] = []

    try {
      const { variables, injectedFromVars } = await resolveVariables(
        dto.templateContext?.variables,
        jobId,
        secretLogger,
      )

      const resolved = await resolveTemplates(
        har as unknown as Record<string, unknown>,
        secretStoreRegistry,
        variables,
        jobId,
        secretLogger,
      )
      har = resolved.value as unknown as typeof har
      injectedSecrets = [...injectedFromVars, ...resolved.injectedSecrets]

      // Log injection summary
      const cacheHitCount = injectedSecrets.filter(
        (s) => s.value !== undefined, // all injected secrets have a value; fromCache is in SecretValue
      ).length
      const schemes = [
        ...new Set(injectedSecrets.map((s) => s.uri.split('://')[0]).filter(Boolean)),
      ]
      if (injectedSecrets.length > 0) {
        this.logger.log(
          JSON.stringify({
            event: 'secret.inject.complete',
            job_id: jobId,
            injected_count: injectedSecrets.length,
            schemes,
          }),
        )
      }
    } catch (err) {
      if (err instanceof TemplateError) {
        this.logger.warn(
          JSON.stringify({
            event: 'proxy_error',
            reason: 'template_error',
            job_id: jobId,
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
          job_id: jobId,
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
          job_id: jobId,
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

    // 5. Evaluate security policy (optional bypass — dangerous; local/debug only)
    let policyResult: PolicyResult
    if (env.relay.disablePolicy) {
      this.logger.warn(
        JSON.stringify({
          event: 'proxy_warn',
          reason: 'policy_disabled',
          message: 'RELAY_DISABLE_POLICY=true; SSRF policy evaluation is bypassed',
          job_id: jobId,
          url: har.url,
          method: har.method,
          host,
          user_id: userId,
          tenant_id: tenantId,
        }),
      )
      policyResult = {
        allowed: true,
        ruleId: 'policy_disabled',
        enforce: PLATFORM_DEFAULT_POLICY.defaults ?? {},
      }
    } else {
      policyResult = evaluatePolicy(PLATFORM_DEFAULT_POLICY, ctx, env.relay.policyDebug)
    }
    if (!policyResult.allowed) {
      this.logger.warn(
        JSON.stringify({
          event: 'proxy_error',
          reason: 'policy_denied',
          job_id: jobId,
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

    // Log masking events for any secrets found in the response
    for (const uri of masking.maskedSecretUris) {
      this.logger.warn(
        JSON.stringify({
          event: 'secret.mask.triggered',
          job_id: jobId,
          secretPath: uri,
          maskedIn: [
            ...(masking.bodyMasked ? ['body'] : []),
            ...(masking.headersMasked ? ['headers'] : []),
          ],
        }),
      )
    }

    this.logger.log(
      JSON.stringify({
        event: 'proxy_response',
        job_id: jobId,
        method: har.method,
        url: har.url,
        status: nativeResponse.status,
        status_text: nativeResponse.statusText,
        duration_ms: durationMs,
        response_body_bytes: Buffer.byteLength(maskedBody, 'utf8'),
        truncated: maskedHeaders['x-slaops-truncated'] === 'true',
        secrets_masked: masking.maskedSecretUris.length,
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
      ...(masking.maskedSecretUris.length > 0 ? { masking } : {}),
    }
  }
}
