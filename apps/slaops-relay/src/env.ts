/**
 * Typed accessor for environment variables.
 * All configuration in slaops-relay comes from process.env — there is no
 * @slaops/config dependency so the relay can be deployed independently.
 */
export const env = {
  port: parseInt(process.env.PORT ?? '3002', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  /**
   * API key callers (e.g. slaops-cloud) must supply as `Authorization: Bearer <key>`
   * to access the queue endpoints. If unset, auth is disabled (development only).
   */
  apiKey: process.env.RELAY_API_KEY,

  relay: {
    secretBackend: process.env.RELAY_SECRET_BACKEND ?? 'env',
    secretCacheTtlS: parseInt(process.env.RELAY_SECRET_CACHE_TTL_S ?? '300', 10),
    secretPrefetch: process.env.RELAY_SECRET_PREFETCH
      ? process.env.RELAY_SECRET_PREFETCH.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    proxyTimeoutMs: parseInt(process.env.RELAY_PROXY_TIMEOUT_MS ?? '30000', 10),
    proxyMaxBodyBytes: parseInt(process.env.RELAY_PROXY_MAX_BODY_BYTES ?? '10485760', 10),
    minSecretMaskLength: 8,
  },

  /**
   * Async queue backend.
   * memory  — in-process, zero dependencies (default)
   * sqs     — AWS SQS + DynamoDB (requires RELAY_SQS_QUEUE_URL + RELAY_DYNAMODB_TABLE)
   */
  queue: {
    backend: process.env.RELAY_QUEUE_BACKEND ?? 'memory',
    jobTtlMs: parseInt(process.env.RELAY_QUEUE_JOB_TTL_MS ?? String(10 * 60 * 1000), 10),
    workerConcurrency: parseInt(process.env.RELAY_QUEUE_CONCURRENCY ?? '5', 10),
  },

  vault: {
    addr: process.env.RELAY_VAULT_ADDR ?? 'http://127.0.0.1:8200',
    token: process.env.RELAY_VAULT_TOKEN,
    mount: process.env.RELAY_VAULT_MOUNT ?? 'secret',
  },

  /**
   * Platform-queue outbound polling (delivery_mode = platform-queue).
   * When the relay cannot accept inbound connections it polls slaops-cloud
   * for pending jobs and posts results back.
   *
   * RELAY_PLATFORM_URL    — slaops-cloud base URL (e.g. https://api.slaops.com)
   * RELAY_PLATFORM_TOKEN  — Bearer token sent to slaops-cloud (= connection api_key)
   * RELAY_PLATFORM_POLL_INTERVAL_MS — how often to poll for jobs (default: 5000)
   */
  platform: {
    url: process.env.RELAY_PLATFORM_URL,
    token: process.env.RELAY_PLATFORM_TOKEN,
    pollIntervalMs: parseInt(process.env.RELAY_PLATFORM_POLL_INTERVAL_MS ?? '5000', 10),
  },

  /**
   * JWT-based authentication for inbound platform requests and Aegis delegation.
   *
   * RELAY_ID                  — UUID assigned by slaops-cloud at registration. Used to validate
   *                             the `aud` claim on inbound platform JWTs.
   * SLAOPS_VENDOR_JWKS_URL    — URL of the slaops-cloud JWKS endpoint. Used to validate platform JWTs.
   * AEGIS_JWKS_URL            — URL of the linked Aegis instance JWKS endpoint. Used to validate
   *                             session delegation JWTs.
   * AEGIS_REQUIRED            — When "true", reject jobs without a valid Aegis delegation JWT.
   */
  jwt: {
    relayId: process.env.RELAY_ID,
    vendorJwksUrl: process.env.SLAOPS_VENDOR_JWKS_URL,
    aegisJwksUrl: process.env.AEGIS_JWKS_URL,
    aegisRequired: process.env.AEGIS_REQUIRED === 'true',
  },
} as const
