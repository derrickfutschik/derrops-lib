---
id: relay-secret-injection
title: Relay Secret Injection
sidebar_label: Secret Injection
sidebar_position: 11
created_at: 2026-04-13
updated_at: 2026-04-13
implemented_at: ~
author: dfutschik
status: draft
tags:
  - component-design
  - security
  - relay
---

# Relay Secret Injection

Secret injection lets the Cloud Relay resolve sensitive values from external secret stores at execution time — before the outbound HTTP request leaves the Relay. Secrets are never transmitted from the browser to the Relay; only a URI reference travels on the wire.

## Template Syntax

Secrets are embedded in HAR request fields using double-brace syntax:

```
{{<secret-uri>}}
```

The URI scheme identifies the backend. The Relay parses the scheme, selects the matching `SecretStore` implementation, and resolves the value at request execution time.

### URI Formats by Backend

| Backend             | URI format                                               | Example                                                                                         |
| ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| AWS Secrets Manager | `aws-secretsmanager://<arn>`                             | `aws-secretsmanager://arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/api-key-XyZ123` |
| GCP Secret Manager  | `gcp-secretsmanager://<resource-path>`                   | `gcp-secretsmanager://projects/my-project-123/secrets/db-password/versions/latest`              |
| Azure Key Vault     | `azure-keyvault://<vault-host>/secrets/<name>/<version>` | `azure-keyvault://myvault.vault.azure.net/secrets/db-password/abc123`                           |
| HashiCorp Vault     | `vault://<host>/<engine-mount>/<path>`                   | `vault://vault.mycompany.com/secret/data/db-password`                                           |

The version segment may be omitted for Azure Key Vault (`/secrets/<name>`) to resolve the current version. For GCP, use `versions/latest` to resolve the latest enabled version.

### JSON Field Selection

Structured secrets (JSON objects) expose individual fields using a `#field` fragment appended to the URI:

```
{{aws-secretsmanager://arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db-creds#password}}
```

The Relay fetches the full secret, parses it as JSON, and returns the value of the named field. If the secret is not valid JSON or the field does not exist, a `SecretStoreError` with code `INVALID_FORMAT` is thrown and the request fails before it is sent.

### Resolved Fields

Expressions are resolved in the following fields of `HarRequest`:

- `url`
- `headers[].value`
- `queryString[].value`
- `cookies[].value`
- `postData.text`
- `postData.params[].value`

### JIT Expressions (non-secret)

The template system also supports just-in-time generated values. These do not require a secret store:

| Expression                  | Resolved to                                     |
| --------------------------- | ----------------------------------------------- |
| `{{jit:uuid}}`              | UUID v4                                         |
| `{{jit:uuid-short}}`        | First 8 hex chars of a UUID                     |
| `{{jit:timestamp}}`         | Current UTC ISO 8601 timestamp                  |
| `{{jit:timestamp-unix}}`    | Unix epoch in seconds                           |
| `{{jit:timestamp-unix-ms}}` | Unix epoch in milliseconds                      |
| `{{jit:random-hex:N}}`      | N cryptographically random hex characters       |
| `{{var:NAME}}`              | Named variable from `templateContext.variables` |

JIT values are **not** masked in responses (see [Response Secret Masking](#response-secret-masking)).

## Wire Format Example

A request using an AWS Secrets Manager key, a GCP secret, a JIT idempotency key, and a named variable:

```json
{
  "request": {
    "method": "POST",
    "url": "https://api.partner.com/v1/payments",
    "httpVersion": "HTTP/1.1",
    "headers": [
      {
        "name": "Authorization",
        "value": "Bearer {{aws-secretsmanager://arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/partner-api-key}}"
      },
      {
        "name": "X-DB-Password",
        "value": "{{gcp-secretsmanager://projects/my-project-123/secrets/db-password/versions/latest}}"
      },
      { "name": "Idempotency-Key", "value": "{{jit:uuid}}" },
      { "name": "X-Request-Time", "value": "{{jit:timestamp}}" },
      { "name": "X-Correlation-Id", "value": "{{var:correlationId}}" }
    ],
    "queryString": [],
    "cookies": [],
    "postData": {
      "mimeType": "application/json",
      "text": "{\"amount\": 100, \"reference\": \"{{jit:uuid-short}}\"}"
    },
    "headersSize": -1,
    "bodySize": -1
  },
  "timeoutMs": 15000,
  "templateContext": {
    "variables": {
      "correlationId": {
        "type": "env",
        "envVar": "CORRELATION_ID_PREFIX"
      }
    }
  }
}
```

After template resolution — before the outbound HTTP request is sent:

| Expression                     | Resolved to                                  |
| ------------------------------ | -------------------------------------------- |
| `{{aws-secretsmanager://...}}` | API key fetched from AWS Secrets Manager     |
| `{{gcp-secretsmanager://...}}` | Password fetched from GCP Secret Manager     |
| `{{jit:uuid}}`                 | `f47ac10b-58cc-4372-a567-0e02b2c3d479`       |
| `{{jit:timestamp}}`            | `2026-04-13T10:00:00.123Z`                   |
| `{{var:correlationId}}`        | Value of `process.env.CORRELATION_ID_PREFIX` |
| `{{jit:uuid-short}}` in body   | `f47ac10b`                                   |

## Backend Implementations

### URI Scheme → Implementation Dispatch

The `SecretStore` interface is now addressed by URI scheme. The `SecretStoreRegistry` maps scheme prefixes to registered implementations. When the Relay resolves a template expression it:

1. Extracts the scheme from the URI (e.g. `aws-secretsmanager`).
2. Looks up the registered factory for that scheme.
3. Passes the full URI (minus the `scheme://` prefix) to the implementation as the `secretId`.
4. Returns the resolved `SecretValue`.

Multiple schemes may be active simultaneously within a single request — for example, an `Authorization` header from AWS Secrets Manager and a database password from HashiCorp Vault.

### The `SecretStore` Interface

Defined in `app/src/secrets/secret-store.ts`.

```typescript
/**
 * Describes a secret retrieved from a secret store.
 * The raw value is always a string; structured secrets are JSON strings.
 */
export type SecretValue = {
  /** The raw secret string (or JSON string for structured secrets). */
  value: string
  /** ISO 8601 timestamp of when this value was last fetched or cached. */
  fetchedAt: string
  /** True if this value was served from the local cache rather than the store. */
  fromCache: boolean
}

/**
 * Thrown by SecretStore implementations when a secret cannot be retrieved.
 */
export class SecretStoreError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_FOUND' // Secret URI does not exist in the store
      | 'ACCESS_DENIED' // Credentials or IAM policy denied access
      | 'STORE_UNAVAILABLE' // Secret store is unreachable (network, config)
      | 'INVALID_FORMAT', // Secret exists but cannot be parsed as expected
    public readonly secretUri: string,
  ) {
    super(message)
    this.name = 'SecretStoreError'
  }
}

/**
 * Cloud-agnostic interface for retrieving secrets.
 * Implementations receive the URI path (everything after scheme://).
 */
export interface SecretStore {
  /** Retrieve a secret. secretUri is the full original URI. */
  getSecret(secretUri: string): Promise<SecretValue>

  /**
   * Retrieve a single field from a structured (JSON) secret.
   * Equivalent to getSecret() + JSON.parse()[field].
   */
  getSecretField(secretUri: string, field: string): Promise<SecretValue>

  /** Check whether a secret exists without fetching its value. */
  hasSecret(secretUri: string): Promise<boolean>

  /** Optional: list available secret URIs. Returns null if unsupported. */
  listSecrets?(): Promise<string[] | null>

  /** Optional: warm the local cache for a set of secret URIs. */
  prefetch?(secretUris: string[]): Promise<void>
}
```

### Built-in Implementations

| URI Scheme           | Package           | Backend                              | Auth method                                  |
| -------------------- | ----------------- | ------------------------------------ | -------------------------------------------- |
| `aws-secretsmanager` | `app-aws/`        | AWS Secrets Manager                  | IAM role (instance profile / execution role) |
| `gcp-secretsmanager` | `app-gcp/`        | GCP Secret Manager                   | Workload Identity or service account key     |
| `azure-keyvault`     | `app-azure/`      | Azure Key Vault                      | Managed Identity or client credentials       |
| `vault`              | `app/` (built-in) | HashiCorp Vault (self-hosted or HCP) | AppRole, token, or Kubernetes auth           |

HashiCorp Vault ships in the cloud-agnostic `app/` package because it is commonly used in on-premises and multi-cloud environments without any cloud-vendor dependency.

#### AWS Secrets Manager

Scheme: `aws-secretsmanager`

The URI after `aws-secretsmanager://` is passed directly to the AWS SDK as the secret identifier (name or full ARN). ARNs are recommended in production to avoid ambiguity across regions and accounts.

```
aws-secretsmanager://arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/api-key-XyZ123
aws-secretsmanager://prod/api-key          ← by name (current region, auto-resolved)
```

Authentication uses the IAM execution role attached to the relay's Lambda function or EC2 instance — no credentials are stored in the Relay's environment.

#### GCP Secret Manager

Scheme: `gcp-secretsmanager`

The path after `gcp-secretsmanager://` is the GCP resource name:

```
gcp-secretsmanager://projects/<project-id>/secrets/<secret-id>/versions/<version>
gcp-secretsmanager://projects/my-project-123/secrets/db-password/versions/latest
```

Authentication uses Application Default Credentials (ADC) — typically Workload Identity on GKE or a service account key file set via `GOOGLE_APPLICATION_CREDENTIALS`.

#### Azure Key Vault

Scheme: `azure-keyvault`

The path after `azure-keyvault://` follows Azure's secret URL format:

```
azure-keyvault://<vault-name>.vault.azure.net/secrets/<secret-name>
azure-keyvault://<vault-name>.vault.azure.net/secrets/<secret-name>/<version>
```

Omitting the version resolves the current (latest) enabled version. Authentication uses Azure Managed Identity or a client credentials flow configured via environment variables (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`).

#### HashiCorp Vault

Scheme: `vault`

The path after `vault://` is `<host>/<mount>/<path>`:

```
vault://vault.mycompany.com/secret/data/db-password      ← KV v2
vault://vault.mycompany.com/kv/db-password               ← KV v1
```

For KV v2, the implementation automatically strips the `data/` segment when constructing the API path if absent, and handles the nested `data.data` response envelope. Auth method is selected via `VAULT_AUTH_METHOD` (`token`, `approle`, or `kubernetes`).

### Caching

All network-backed implementations are wrapped with `CachingSecretStore` to avoid a remote call for every request that uses a secret. The cache is keyed by full secret URI (including fragment, e.g. `aws-secretsmanager://arn:...#field`).

```typescript
/**
 * Decorator that wraps any SecretStore with an in-process LRU/TTL cache.
 * Defined in app/src/secrets/caching-secret-store.ts.
 *
 * The cache does not survive Lambda cold starts or container restarts.
 * This is intentional — stale secrets are a bigger risk than re-fetch latency.
 */
export class CachingSecretStore implements SecretStore {
  constructor(
    private readonly inner: SecretStore,
    private readonly ttlSeconds: number,
  ) {}
}
```

TTL is configurable per scheme via `RELAY_SECRET_CACHE_TTL_S` (default: `300` seconds / 5 minutes). Set to `0` to disable caching for a scheme.

### Registry and Factory

The `SecretStoreRegistry` maps URI scheme strings to factory functions. Built-in registrations happen in each package's entry point.

```typescript
/** Factory receives process env and returns a configured SecretStore. */
export type SecretStoreFactory = (env: NodeJS.ProcessEnv) => SecretStore

export class SecretStoreRegistry {
  /** Register a factory for a URI scheme. Throws if the scheme is already taken. */
  register(scheme: string, factory: SecretStoreFactory): void

  /**
   * Resolve a secret URI. Extracts the scheme, looks up the factory, creates
   * (or reuses) the implementation, and delegates to SecretStore.getSecret().
   */
  resolve(secretUri: string): Promise<SecretValue>

  /** Resolve a specific field from a structured secret URI. */
  resolveField(secretUri: string, field: string): Promise<SecretValue>
}

export const secretStoreRegistry = new SecretStoreRegistry()
```

Built-in registrations:

```typescript
// app/src/secrets/index.ts
secretStoreRegistry.register('vault', (env) => new VaultSecretStore(env))

// app-aws/src/index.ts
secretStoreRegistry.register('aws-secretsmanager', (env) => new AwsSecretsManagerStore(env))

// app-azure/src/index.ts
secretStoreRegistry.register('azure-keyvault', (env) => new AzureKeyVaultStore(env))

// app-gcp/src/index.ts
secretStoreRegistry.register('gcp-secretsmanager', (env) => new GcpSecretManagerStore(env))
```

### Bringing Your Own Implementation

Register a custom implementation before bootstrap:

```typescript
import { createRelayApp, secretStoreRegistry } from '@derrops/cloud-relay'
import { ConjurSecretStore } from './conjur-secret-store'

secretStoreRegistry.register(
  'conjur',
  (env) =>
    new ConjurSecretStore({
      applianceUrl: env.CONJUR_APPLIANCE_URL!,
      account: env.CONJUR_ACCOUNT!,
      authnToken: env.CONJUR_AUTHN_TOKEN!,
    }),
)

// Reference in HAR: {{conjur://vault.myco.com/data/api-key}}
const app = await createRelayApp()
await app.listen(process.env.PORT ?? 3000)
```

`ConjurSecretStore` only needs to implement the `SecretStore` interface. The `secretUri` parameter receives the full original URI (e.g. `conjur://vault.myco.com/data/api-key`).

## Module Structure

```
apps/derrops-cloud-relay/
├── app/                          # Cloud-agnostic NestJS core
│   └── src/
│       ├── secrets/
│       │   ├── secret-store.ts             # SecretStore interface + SecretStoreError
│       │   ├── secret-store-registry.ts    # SecretStoreRegistry + SecretStoreFactory
│       │   ├── caching-secret-store.ts     # CachingSecretStore decorator
│       │   └── vault-secret-store.ts       # Built-in: HashiCorp Vault backend
│       ├── template/
│       │   └── template-resolver.ts        # {{expr}} resolution + injectedSecrets tracking
│       └── masking/
│           └── secret-masker.ts            # Response body/header masking
│
├── app-aws/                      # AWS-specific implementations
│   └── src/secrets/
│       └── aws-secrets-manager-store.ts
│
├── app-azure/                    # Azure-specific implementations
│   └── src/secrets/
│       └── azure-key-vault-store.ts
│
└── app-gcp/                      # GCP-specific implementations
    └── src/secrets/
        └── gcp-secret-manager-store.ts
```

## Secret Injection Logging

The Relay emits structured log events at each stage of the injection pipeline. Log entries never include the resolved secret value — only the URI (which itself contains no secret material) and derived metadata.

### Log Events

| Event                       | Level   | When                                                            |
| --------------------------- | ------- | --------------------------------------------------------------- |
| `secret.resolve.start`      | `debug` | Resolution of a secret URI begins                               |
| `secret.resolve.cache_hit`  | `debug` | Value served from local cache                                   |
| `secret.resolve.cache_miss` | `debug` | Cache miss; fetching from remote store                          |
| `secret.resolve.success`    | `info`  | Secret successfully resolved                                    |
| `secret.resolve.error`      | `error` | Resolution failed (store unavailable, access denied, not found) |
| `secret.inject.complete`    | `info`  | All secrets resolved; request ready to dispatch                 |
| `secret.mask.triggered`     | `warn`  | A resolved secret value was found in the response and masked    |

### Log Event Schema

```typescript
// secret.resolve.start / cache_hit / cache_miss / success
{
  event: 'secret.resolve.start' | 'secret.resolve.cache_hit'
       | 'secret.resolve.cache_miss' | 'secret.resolve.success',
  secretScheme: string,    // e.g. 'aws-secretsmanager'
  secretPath: string,      // URI without the scheme (safe to log — no secret material)
  field?: string,          // JSON field selector if present
  fromCache: boolean,      // true for cache_hit events
  jobId: string,           // relay job ID for correlation
}

// secret.resolve.error
{
  event: 'secret.resolve.error',
  secretScheme: string,
  secretPath: string,
  errorCode: 'NOT_FOUND' | 'ACCESS_DENIED' | 'STORE_UNAVAILABLE' | 'INVALID_FORMAT',
  errorMessage: string,   // safe human-readable message (no secret values)
  jobId: string,
}

// secret.inject.complete
{
  event: 'secret.inject.complete',
  injectedCount: number,          // total secrets resolved
  cacheHitCount: number,          // served from cache
  remoteFetchCount: number,       // fetched from remote store
  schemes: string[],              // unique schemes used, e.g. ['aws-secretsmanager', 'vault']
  jobId: string,
}

// secret.mask.triggered
{
  event: 'secret.mask.triggered',
  secretPath: string,      // which secret's value was found in the response
  maskedIn: ('body' | 'headers')[],
  jobId: string,
}
```

### Example Log Sequence

For a request containing two secret expressions from different backends:

```
[DEBUG] secret.resolve.start        { scheme: 'aws-secretsmanager', path: 'arn:aws:...', jobId: 'job-1' }
[DEBUG] secret.resolve.cache_miss   { scheme: 'aws-secretsmanager', path: 'arn:aws:...', jobId: 'job-1' }
[INFO]  secret.resolve.success      { scheme: 'aws-secretsmanager', path: 'arn:aws:...', fromCache: false, jobId: 'job-1' }
[DEBUG] secret.resolve.start        { scheme: 'vault', path: 'vault.myco.com/secret/data/db', jobId: 'job-1' }
[DEBUG] secret.resolve.cache_hit    { scheme: 'vault', path: 'vault.myco.com/secret/data/db', fromCache: true, jobId: 'job-1' }
[INFO]  secret.inject.complete      { injectedCount: 2, cacheHitCount: 1, remoteFetchCount: 1, schemes: ['aws-secretsmanager','vault'], jobId: 'job-1' }
```

If the response contains a masked value:

```
[WARN]  secret.mask.triggered       { path: 'arn:aws:...', maskedIn: ['body'], jobId: 'job-1' }
```

## Response Secret Masking

After template expressions are resolved and the outbound request is dispatched, the Relay tracks the resolved values of all injected secrets. On receiving the response it scans both the response body and response headers for those values and **replaces them with a redaction marker** before returning the response to the caller.

This guards against scenarios where a target API echoes back a sensitive value — for example, an error response that reflects the `Authorization` header.

### Masking Algorithm

```text
FUNCTION maskSecrets(response, injectedSecrets):
  FOR each secret in injectedSecrets:
    IF secret.value appears in response.body:
      response.body = replace(response.body, secret.value, '[REDACTED:<scheme>:<path-hash>]')
      record secret.uri in maskedSecretUris
    FOR each headerName in response.headers:
      IF secret.value appears in response.headers[headerName]:
        response.headers[headerName] = replace(..., '[REDACTED:<scheme>:<path-hash>]')
        record secret.uri in maskedSecretUris
  RETURN { response, maskedSecretUris }
```

Rules:

- Masking is always performed — it cannot be disabled by the caller.
- JIT-generated values (`{{jit:*}}`) are **not** masked in responses.
- Masking is exact-string, case-sensitive. Partial or encoded matches are not detected in iteration 1.
- The redaction marker includes the scheme and a short hash of the path for traceability, not the raw URI.

### `CloudProxyResponse` Masking Metadata

```typescript
export type CloudProxyResponse = {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  requestedAt: string
  /** Present when one or more secrets were detected and masked in the response. */
  masking?: {
    /** URIs (scheme + path, no secret material) of secrets whose values were masked. */
    maskedSecretUris: string[]
    /** True if masking occurred in the response body. */
    bodyMasked: boolean
    /** True if masking occurred in the response headers. */
    headersMasked: boolean
  }
}
```

### Example

Request sends `Authorization: Bearer {{aws-secretsmanager://arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/api-key}}`. The target API returns a 401 body that echoes the token:

```json
{ "error": "invalid_token", "token": "sk-abc123..." }
```

The Relay masks the echo before returning:

```json
{ "error": "invalid_token", "token": "[REDACTED:aws-secretsmanager:a3f9c12b]" }
```

Response metadata:

```json
{
  "status": 401,
  "masking": {
    "maskedSecretUris": [
      "aws-secretsmanager://arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/api-key"
    ],
    "bodyMasked": true,
    "headersMasked": false
  }
}
```

## Error Handling

| Scenario                                | Behaviour                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| Unknown URI scheme                      | Request fails immediately with `400 Bad Request` before any network call is made |
| Secret not found (`NOT_FOUND`)          | Request fails with `424 Failed Dependency`; error body includes the failing URI  |
| Access denied (`ACCESS_DENIED`)         | Request fails with `502 Bad Gateway`; error logged at `error` level              |
| Store unreachable (`STORE_UNAVAILABLE`) | Request fails with `502 Bad Gateway`; retry behaviour is left to the caller      |
| Secret value too short for masking      | Warning logged; injection proceeds; masking skipped for that value               |
| JSON field not found (`INVALID_FORMAT`) | Request fails with `424 Failed Dependency`                                       |

In all failure cases the outbound HTTP request is **not sent** — the error surfaces before the request leaves the Relay.

## Related Documents

- [Component Design — Cloud Relay](./component-cloud-relay) — overall architecture and HAR template expression system
- [Aegis Token Broker](./aegis-token-broker-design) — portal-controlled credential delegation (separate from relay-side secret injection)
- [Local Relay](./local-relay) — secret injection behaviour in local development relay
- [Cloud Relay Security](./cloud-relay-security) — authentication model and trust boundaries
