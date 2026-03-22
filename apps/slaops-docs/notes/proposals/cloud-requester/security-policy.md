---
sidebar_position: 13
title: Cloud Requester Security Policy
---

# Cloud Requester Security Policy

To improve security, CloudRequester supports security policies to control what requests are allowed to be made or denied by the platform.

- who can call the proxy
- which destinations are allowed
- which methods/ports/protocols are allowed
- which headers are allowed or stripped
- whether redirects are allowed
- rate/size/time limits

```mermaid
flowchart TD
  A[Tenant] --> B[Policy (stored in DB / config)]
  B --> C[Lambda / Proxy]
  C --> D[Validation pipeline]
```

## Policy

JSON policy document like this

```json
{
  "version": "2026-03-20",
  "mode": "deny-by-default",
  "defaults": {
    "allowRedirects": false,
    "maxRedirects": 0,
    "maxRequestBodyBytes": 262144,
    "maxResponseBodyBytes": 1048576,
    "timeoutMs": 15000,
    "allowedProtocols": ["https"],
    "allowedPorts": [443]
  },
  "hardDeny": [
    { "host.isIp": true },
    { "host.isLocalhost": true },
    { "host.isPrivateNetwork": true },
    { "host.isLinkLocal": true },
    { "host.isLoopback": true },
    { "host.isMulticast": true },
    { "host.matches": ["*.internal", "*.local"] },
    { "url.matches": ["http://169.254.169.254/*", "http://metadata.google.internal/*"] }
  ],
  "rules": [
    {
      "id": "allow-public-api-readonly",
      "effect": "allow",
      "when": {
        "all": [
          { "user.authenticated": true },
          { "request.method.in": ["GET", "HEAD"] },
          { "host.matches": ["api.github.com", "jsonplaceholder.typicode.com", "*.stripe.com"] }
        ]
      },
      "enforce": {
        "stripRequestHeaders": ["cookie", "x-forwarded-for", "x-real-ip"],
        "allowRequestHeaders": ["accept", "content-type", "authorization"],
        "allowResponseHeaders": ["content-type", "content-length", "etag"]
      }
    },
    {
      "id": "allow-tenant-domains",
      "effect": "allow",
      "when": {
        "all": [
          { "tenant.id": { "exists": true } },
          { "host.inTenantAllowlist": true },
          { "request.method.in": ["GET", "POST", "PUT", "PATCH", "DELETE"] }
        ]
      },
      "enforce": {
        "allowRedirects": false,
        "timeoutMs": 20000
      }
    }
  ]
}
```

## Request Context Shape

```json
{
  "user": {
    "id": "user-123",
    "authenticated": true,
    "roles": ["developer"]
  },
  "tenant": {
    "id": "westpac-sit",
    "plan": "enterprise",
    "allowlist": ["api.westpac.com.au", "*.example-partner.com"]
  },
  "request": {
    "method": "POST",
    "headers": {
      "accept": "application/json",
      "content-type": "application/json"
    },
    "bodyBytes": 420
  },
  "url": {
    "raw": "https://api.westpac.com.au/payments",
    "scheme": "https",
    "host": "api.westpac.com.au",
    "port": 443,
    "path": "/payments",
    "query": {}
  },
  "host": {
    "resolvedIps": ["203.0.113.10"],
    "isIp": false,
    "isLocalhost": false,
    "isPrivateNetwork": false,
    "isLinkLocal": false,
    "isLoopback": false,
    "isMulticast": false
  }
}
```

## Validation pipeline

- 1.  Parse URL
- 2.  Validate domain against tenant rules
- 3.  Resolve DNS → IP
- 4.  Check IP not private
- 5.  Enforce protocol/port
- 6.  Forward request

Deny First Layer:

```typescript
if (isPrivateIP(ip)) reject()
if (isMetadataEndpoint(host)) reject()
if (!isAllowedDomain(host)) reject()
```

## Core operators

### Boolean composition

```json

{ "all": [ ... ] }
{ "any": [ ... ] }
{ "not": { ... } }
// Equality / membership
{ "request.method": "GET" }
{ "request.method.in": ["GET", "HEAD"] }
{ "tenant.id": "westpac-sit" }
// Existence
{ "tenant.id": { "exists": true } }
// Pattern matching
{ "host.matches": ["api.github.com", "*.stripe.com"] }
{ "url.matches": ["https://api.example.com/v1/*"] }
{ "request.headerNames.matches": ["x-*", "content-type"] }
// Numeric comparisons
{ "request.bodyBytes.lte": 1048576 }
{ "url.port.in": [443, 8443] }
{ "rate.requestsPerMinute.lte": 60 }
// Derived flags

// These are computed by your proxy, not supplied by the user:

{ "host.isPrivateNetwork": true }
{ "host.inTenantAllowlist": true }
{ "url.scheme.in": ["https"] }
```

Evaluation order

Use this exact flow:

1. Normalize request

Parse URL, method, headers, body size.

2. Resolve DNS

Resolve host to IPs.

3. Compute derived flags

Examples:

host.isPrivateNetwork
host.isLoopback
host.inTenantAllowlist 4. Apply hardDeny

If any match, reject immediately.

5. Apply rules

First matching allow rule wins, or merge matched rules if you want policy layering.

6. If no allow rule matches

Reject because mode is deny-by-default.

That gives you a safe default.

Minimal first version

This is the version I’d actually build first.

```json
{
  "version": "2026-03-20",
  "mode": "deny-by-default",
  "hardDeny": [
    { "host.isIp": true },
    { "host.isLocalhost": true },
    { "host.isPrivateNetwork": true },
    { "host.isLinkLocal": true },
    { "url.scheme.in": ["http", "file", "ftp"] }
  ],
  "rules": [
    {
      "id": "public-readonly",
      "effect": "allow",
      "when": {
        "all": [
          { "request.method.in": ["GET", "HEAD"] },
          { "host.matches": ["api.github.com", "httpbin.org", "jsonplaceholder.typicode.com"] }
        ]
      }
    },
    {
      "id": "tenant-approved",
      "effect": "allow",
      "when": {
        "all": [{ "user.authenticated": true }, { "host.inTenantAllowlist": true }]
      }
    }
  ]
}
```

Example tenant allowlist DSL

You could store tenant policy separately:

```json
{
  "tenantId": "westpac-sit",
  "destinations": [
    {
      "name": "westpac-api",
      "match": ["api.westpac.com.au", "*.westpac.com.au"],
      "methods": ["GET", "POST"],
      "protocols": ["https"],
      "ports": [443]
    },
    {
      "name": "partner-sandbox",
      "match": ["sandbox.partner.com"],
      "methods": ["GET", "POST", "PUT"],
      "protocols": ["https"],
      "ports": [443]
    }
  ]
}
```

Then compute:

```json
{ "host.inTenantAllowlist": true }
```

by checking the host against that tenant config.

Example policies
Read-only public API access

```json
{
  "id": "readonly-public",
  "effect": "allow",
  "when": {
    "all": [{
        "request.method.in": ["GET", "HEAD"]
      },
      {
        "host.matches": ["api.github.com", "pokeapi.co", "httpbin.org"]
      }
    ]
  },
  "enforce": {
    "timeoutMs": 10000,
    "maxResponseBodyBytes": 524288
  }
}
// Block dangerous headers
{
  "id": "strip-dangerous-headers",
  "effect": "allow",
  "when": {
    "all": [{
      "host.inTenantAllowlist": true
    }]
  },
  "enforce": {
    "stripRequestHeaders": [
      "host",
      "cookie",
      "x-forwarded-for",
      "x-real-ip",
      "cf-connecting-ip"
    ]
  }
}
// Only allow JSON APIs
{
  "id": "json-only",
  "effect": "allow",
  "when": {
    "all": [{
        "host.inTenantAllowlist": true
      },
      {
        "request.header.content-type.in": ["application/json"]
      }
    ]
  }
}
```

TypeScript model

Here is a good starting point for your implementation.

```json
export type Policy = {
  version: string;
  mode: "deny-by-default" | "allow-by-default";
  defaults?: Enforcement;
  hardDeny?: Condition[];
  rules: Rule[];
};

export type Rule = {
  id: string;
  effect: "allow" | "deny";
  when: Condition;
  enforce?: Enforcement;
};

export type Enforcement = {
  allowRedirects?: boolean;
  maxRedirects?: number;
  maxRequestBodyBytes?: number;
  maxResponseBodyBytes?: number;
  timeoutMs?: number;
  allowedProtocols?: string[];
  allowedPorts?: number[];
  stripRequestHeaders?: string[];
  allowRequestHeaders?: string[];
  allowResponseHeaders?: string[];
};

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | Record<string, unknown>;
Evaluator skeleton
type RequestContext = Record<string, any>;

export function evaluatePolicy(policy: Policy, ctx: RequestContext) {
  for (const cond of policy.hardDeny ?? []) {
    if (matches(cond, ctx)) {
      return deny("Matched hard deny rule");
    }
  }

  for (const rule of policy.rules) {
    if (matches(rule.when, ctx)) {
      if (rule.effect === "deny") {
        return deny(`Denied by rule ${rule.id}`);
      }
      return allow(rule.id, mergeEnforcement(policy.defaults, rule.enforce));
    }
  }

  if (policy.mode === "deny-by-default") {
    return deny("No allow rule matched");
  }

  return allow("default", policy.defaults ?? {});
}

function allow(ruleId: string, enforce: Enforcement) {
  return { allowed: true, ruleId, enforce };
}

function deny(reason: string) {
  return { allowed: false, reason };
}

And matching:

function matches(condition: Condition, ctx: RequestContext): boolean {
  if ("all" in condition) {
    return condition.all.every(c => matches(c, ctx));
  }
  if ("any" in condition) {
    return condition.any.some(c => matches(c, ctx));
  }
  if ("not" in condition) {
    return !matches(condition.not, ctx);
  }

  return Object.entries(condition).every(([key, expected]) => {
    const actual = getPathValue(ctx, normalizeKey(key));

    if (key.endsWith(".in") && Array.isArray(expected)) {
      return expected.includes(actual);
    }

    if (key.endsWith(".lte")) {
      return typeof actual === "number" && actual <= Number(expected);
    }

    if (key.endsWith(".gte")) {
      return typeof actual === "number" && actual >= Number(expected);
    }

    if (key.endsWith(".matches") && Array.isArray(expected)) {
      return matchPatterns(String(actual ?? ""), expected as string[]);
    }

    if (typeof expected === "object" && expected !== null && "exists" in (expected as any)) {
      const exists = actual !== undefined && actual !== null;
      return exists === Boolean((expected as any).exists);
    }

    return actual === expected;
  });
}

Pattern matching:

function matchPatterns(value: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*") +
        "$",
      "i"
    );
    return regex.test(value);
  });
}
```

Important design choice: host matching

Do not let users match on raw URL strings alone.

Bad:

```json
{ "url.matches": ["*westpac*"] }
```

Good:

```json
{ "host.matches": ["api.westpac.com.au", "*.westpac.com.au"] }
{ "url.scheme.in": ["https"] }
{ "url.port.in": [443] }
```

Because host/scheme/port are much harder to bypass than fuzzy URL matching.

## Hard SSRF protections you should always enforce outside the DSL too

Even if the DSL says allow, still do these as immutable platform rules:

- block resolved IPs in private/link-local/loopback ranges
- block literal IP destinations unless explicitly approved
- block localhost
- block cloud metadata endpoints
- normalize and re-check redirects
- limit request/response size
- limit timeout
- strip hop-by-hop headers
- optionally require DNS resolution from your own resolver

Think of these as kernel rules, while the DSL is the policy layer.

# User policy

Optional narrower restrictions, quotas, or roles.
That gives you:

```
effectivePolicy = platformPolicy + tenantPolicy + userPolicy
```

## Resolved IP Security Layer

```typescript
!isPrivateIP(ip)
!isLoopback(ip)
!isLinkLocal(ip)
```

```typescript
const ips = await dns.resolve(host)

for (const ip of ips) {
  if (isPrivate(ip) || isLoopback(ip) || isLinkLocal(ip)) {
    throw new Error('Blocked: unsafe destination')
  }
}

// then connect using resolved IP
```

## Audit Log

```json
{
  "decision": "allow",
  "ruleId": "allow-tenant-domains",
  "tenantId": "westpac-sit",
  "host": "api.westpac.com.au",
  "method": "POST",
  "resolvedIps": ["203.0.113.10"]
}
```
