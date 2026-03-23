export type Policy = {
  version: string
  mode: 'deny-by-default' | 'allow-by-default'
  defaults?: Enforcement
  hardDeny?: Condition[]
  rules: Rule[]
}

export type Rule = {
  id: string
  effect: 'allow' | 'deny'
  when: Condition
  enforce?: Enforcement
}

export type Enforcement = {
  allowRedirects?: boolean
  maxRedirects?: number
  maxRequestBodyBytes?: number
  maxResponseBodyBytes?: number
  timeoutMs?: number
  allowedProtocols?: string[]
  allowedPorts?: number[]
  stripRequestHeaders?: string[]
  allowRequestHeaders?: string[]
  allowResponseHeaders?: string[]
}

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | Record<string, unknown>

export type PolicyResult =
  | { allowed: true; ruleId: string; enforce: Enforcement }
  | { allowed: false; reason: string }

export type HostContext = {
  resolvedIps: string[]
  isIp: boolean
  isLocalhost: boolean
  isPrivateNetwork: boolean
  isLinkLocal: boolean
  isLoopback: boolean
  isMulticast: boolean
  inTenantAllowlist: boolean
}

export type RequestContext = {
  user: { id: string; authenticated: boolean; roles: string[] }
  tenant: { id: string; plan: string; allowlist: string[] }
  request: { method: string; headers: Record<string, string>; bodyBytes: number }
  url: { raw: string; scheme: string; host: string; port: number; path: string; query: Record<string, string> }
  host: HostContext
}

/** Platform-level default policy for the SLAOps-managed relay (Iteration 1).
 *  Hard-denies all SSRF targets; allow-by-default for authenticated users. */
export const PLATFORM_DEFAULT_POLICY: Policy = {
  version: '2026-03-20',
  mode: 'allow-by-default',
  hardDeny: [
    { 'host.isIp': true },
    { 'host.isLocalhost': true },
    { 'host.isPrivateNetwork': true },
    { 'host.isLinkLocal': true },
    { 'host.isLoopback': true },
    { 'host.isMulticast': true },
    { 'url.scheme.in': ['http', 'file', 'ftp', 'data', 'javascript'] },
  ],
  rules: [],
}
