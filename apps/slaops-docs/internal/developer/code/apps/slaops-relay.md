# slaops-relay

A self-contained, stateless HTTP proxy service. The SLAOps platform connects to it; the portal selects which relay instance to use. The relay's only job is to receive a HAR-format proxy request, resolve secrets and template expressions, enforce SSRF-safe security policies, execute the request, and mask secrets from the response.

**Connection management** (which relay instances exist, their URLs) lives in `apps/slaops-cloud`, not here. The relay has no database and no connection registry.

Designed to be deployed independently — no dependencies on any other SLAOps packages.

---

## Overview

```
Caller ──► POST /cloud-relay/proxy ──► ProxyService
                                           │
                                    1. Resolve templates ({{secret:*}}, {{jit:*}}, {{var:*}})
                                    2. Validate URL + DNS
                                    3. Evaluate security policy (hard-deny SSRF, custom rules)
                                    4. Execute HTTP request
                                    5. Mask injected secrets in response
                                           │
                                    ◄──────┘
```

---

## Running locally

```bash
# Install dependencies
pnpm install

# Start development server (port 3002 by default)
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start
```

Swagger UI is available at `http://localhost:3002/api` when running.

---

## Environment variables

| Variable                     | Default                 | Description                                               |
| ---------------------------- | ----------------------- | --------------------------------------------------------- |
| `PORT`                       | `3002`                  | HTTP port                                                 |
| `NODE_ENV`                   | `development`           | Environment                                               |
| `RELAY_SECRET_BACKEND`       | `env`                   | Secret store backend (`env`, or a custom registered name) |
| `RELAY_SECRET_CACHE_TTL_S`   | `300`                   | Secret cache TTL in seconds (0 = no cache)                |
| `RELAY_SECRET_PREFETCH`      | _(empty)_               | Comma-separated secret IDs to warm on startup             |
| `RELAY_PROXY_TIMEOUT_MS`     | `30000`                 | Default proxy request timeout                             |
| `RELAY_PROXY_MAX_BODY_BYTES` | `10485760`              | Maximum response body size (10 MB)                        |
| `RELAY_VAULT_ADDR`           | `http://127.0.0.1:8200` | HashiCorp Vault address                                   |
| `RELAY_VAULT_TOKEN`          | _(none)_                | Vault token                                               |
| `RELAY_VAULT_MOUNT`          | `secret`                | Vault KV mount path                                       |

---

## API

The relay exposes a single endpoint. Connection management is handled by `apps/slaops-cloud`.

### `POST /cloud-relay/proxy`

Proxy an HTTP request to an external target. The request body follows the [HAR](http://www.softwareishard.com/blog/har-12-spec/) format.

**Headers required:**

- `x-tenant-id` — Tenant UUID
- `x-user-id` — User UUID

**Request body:**

```json
{
  "request": {
    "method": "POST",
    "url": "https://api.example.com/v1/data",
    "httpVersion": "HTTP/1.1",
    "headers": [{ "name": "Authorization", "value": "Bearer {{secret:MY_TOKEN}}" }],
    "queryString": [],
    "cookies": [],
    "headersSize": -1,
    "bodySize": -1,
    "postData": {
      "mimeType": "application/json",
      "text": "{\"key\":\"{{var:myVar}}\"}"
    }
  },
  "timeoutMs": 10000,
  "templateContext": {
    "variables": {
      "myVar": { "type": "literal", "value": "hello" }
    }
  }
}
```

**Success response (`200`):**

```json
{
  "status": 200,
  "statusText": "OK",
  "headers": { "content-type": "application/json" },
  "body": "{\"result\":\"ok\"}",
  "durationMs": 142,
  "requestedAt": "2026-03-23T10:00:00.000Z"
}
```

**Error response (`200` with error shape):**

```json
{
  "error": "Policy denied: host is a private network address",
  "code": "POLICY_DENIED",
  "durationMs": 1
}
```

Error codes: `TIMEOUT` | `NETWORK_ERROR` | `INVALID_URL` | `POLICY_DENIED` | `TEMPLATE_ERROR`

---

## Template expressions

Template expressions can appear in any string field of the HAR request (URL, headers, query params, cookies, body).

| Expression                      | Description                                                     |
| ------------------------------- | --------------------------------------------------------------- |
| `{{secret:MY_SECRET_ID}}`       | Value of secret `MY_SECRET_ID` from the configured secret store |
| `{{secret:MY_SECRET_ID.field}}` | Single field extracted from a JSON-encoded secret               |
| `{{var:name}}`                  | Variable defined in `templateContext.variables`                 |
| `{{jit:uuid}}`                  | Random UUID (generated at request time)                         |
| `{{jit:uuid-short}}`            | 8-character UUID fragment                                       |
| `{{jit:timestamp}}`             | Current time as ISO 8601 string                                 |
| `{{jit:timestamp-unix}}`        | Current Unix timestamp (seconds)                                |
| `{{jit:timestamp-unix-ms}}`     | Current Unix timestamp (milliseconds)                           |
| `{{jit:random-hex:N}}`          | `N`-character random hex string                                 |

### Variable types in `templateContext.variables`

```json
{
  "tokenVar": { "type": "secret", "secretId": "MY_API_KEY" },
  "regionVar": { "type": "env", "envVar": "AWS_REGION" },
  "labelVar": { "type": "literal", "value": "production" }
}
```

Variables of type `secret` and `env` can be referenced as `{{var:name}}`. Direct secret injection via `{{secret:ID}}` bypasses the variable layer entirely.

---

## Security

### Hard-deny SSRF protections (always enforced)

The following targets are unconditionally blocked regardless of any policy rules:

- IP literals (e.g. `1.2.3.4`, `[::1]`)
- Localhost names (`localhost`, `*.local`, `*.internal`)
- Private IPv4 ranges (RFC 1918: `10/8`, `172.16/12`, `192.168/16`)
- Loopback (`127.0.0.0/8`, `::1`)
- Link-local (`169.254.0.0/16`, `fe80::/10`)
- Multicast (`224.0.0.0/4`, `ff00::/8`)
- Cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`, `169.254.170.2`)
- Non-HTTPS protocols (`http`, `ftp`, `file`, `data`, `javascript`)

DNS resolution is performed before policy evaluation — a hostname that resolves to a private IP is blocked even if the hostname itself appears public.

### Policy engine

Policies are evaluated with **deny-wins** semantics: any matching deny rule blocks the request, regardless of other allow rules.

```
1. Hard-deny conditions (above) — checked unconditionally
2. Scan ALL rules for any matching deny
3. Then scan for any matching allow
4. Fall back to policy mode (allow-by-default / deny-by-default)
```

Custom rules can be injected by registering a policy before `bootstrap()`.

### Secret masking

Any secret value injected via `{{secret:*}}` is automatically scanned for in the response body and all response headers. Matches are replaced with `[REDACTED:secret-id]`. The response includes a `masking` field indicating which secrets were masked.

Secrets shorter than 8 characters are not masked (too short to reliably identify without false positives).

---

## Secret backends

The active backend is selected by `RELAY_SECRET_BACKEND`.

### `env` (default)

Reads secrets from environment variables. The secret ID maps directly to an env var name.

```
{{secret:MY_TOKEN}}  →  process.env.MY_TOKEN
{{secret:DB_CREDS.password}}  →  JSON.parse(process.env.DB_CREDS).password
```

### Custom backends

Register a custom `SecretStore` implementation before the app bootstraps:

```typescript
import { secretStoreRegistry } from './src/secrets/secret-store-registry'

secretStoreRegistry.register('my-backend', (env) => new MySecretStore(env))
```

Then set `RELAY_SECRET_BACKEND=my-backend`.

The `SecretStore` interface:

```typescript
interface SecretStore {
  getSecret(id: string): Promise<SecretValue>
  getSecretField(id: string, field: string): Promise<SecretValue>
}
```

All backends are automatically wrapped in a TTL cache (configurable via `RELAY_SECRET_CACHE_TTL_S`).

---

## AWS Lambda deployment

`src/lambda.ts` exports a `handler` compatible with AWS Lambda + API Gateway. The NestJS app instance is cached across warm invocations.

```bash
# Build then deploy the dist/ directory to Lambda
pnpm run build
```

Set `NODE_ENV=production` in the Lambda environment to disable TypeORM `synchronize` mode.

---

## Project structure

```
src/
├── env.ts                          # Typed process.env accessors
├── main.ts                         # Standalone HTTP server entry
├── lambda.ts                       # AWS Lambda handler
├── app.module.ts                   # Root NestJS module
├── policy/
│   ├── types.ts                    # Policy, Rule, Condition, RequestContext types
│   ├── matcher.ts                  # Condition matching (operators: .in, .lte, .gte, .matches)
│   └── evaluator.ts                # evaluatePolicy() — deny-wins evaluation
├── secrets/
│   ├── secret-store.ts             # SecretStore interface + SecretStoreError
│   ├── caching-secret-store.ts     # TTL cache decorator
│   ├── env-secret-store.ts         # process.env backend
│   └── secret-store-registry.ts   # Registry + singleton
├── template/
│   └── template-resolver.ts       # {{expr}} resolution across HAR fields
├── masking/
│   └── secret-masker.ts           # Post-response secret value redaction
└── cloud-relay/
    ├── cloud-relay.module.ts
    ├── cloud-relay.controller.ts   # POST /proxy only
    ├── proxy.service.ts            # 15-step proxy algorithm
    └── dto/                        # Request/response DTOs (HAR format)
```
