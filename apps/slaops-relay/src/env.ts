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
   * SQS-based platform-queue delivery.
   *
   * AWS credentials are obtained at startup via the Cognito Identity Pool and
   * refreshed automatically before they expire. They are never stored on disk.
   * `slaops relay start` injects all variables below into process.env.
   *
   * RELAY_PLATFORM_SQS_QUEUE_URL            — the relay's dedicated SQS queue URL
   * RELAY_PLATFORM_SQS_REGION               — AWS region (default: ap-southeast-2)
   * RELAY_PLATFORM_SQS_ACCESS_KEY_ID        — initial temp AWS access key (in-memory)
   * RELAY_PLATFORM_SQS_SECRET_ACCESS_KEY    — initial temp AWS secret key (in-memory)
   * RELAY_PLATFORM_SQS_SESSION_TOKEN        — initial temp AWS session token (in-memory)
   * RELAY_PLATFORM_SQS_CREDS_EXPIRY         — ISO expiry of the initial temp credentials
   *
   * RELAY_COGNITO_IDENTITY_POOL_ID  — Cognito Identity Pool ID (for credential refresh)
   * RELAY_COGNITO_REGION            — AWS region of the Identity Pool / User Pool
   * RELAY_COGNITO_USER_POOL_ID      — User Pool ID (used as Identity Pool provider key)
   * RELAY_COGNITO_ID_TOKEN          — current Cognito id_token (refreshed as needed)
   * RELAY_COGNITO_REFRESH_TOKEN     — Cognito refresh token (30-day; renews id_token)
   * RELAY_COGNITO_CLIENT_ID         — Cognito app client ID (for token refresh calls)
   * RELAY_COGNITO_DOMAIN            — Cognito hosted UI domain (for token refresh calls)
   */
  platformSqs: {
    // Accept both the canonical prefixed name and the shorter alias used by slaops-cloud
    queueUrl: process.env.RELAY_PLATFORM_SQS_QUEUE_URL ?? process.env.SQS_QUEUE_URL,
    region: process.env.RELAY_PLATFORM_SQS_REGION ?? process.env.SQS_REGION ?? 'ap-southeast-2',
    // Initial credentials injected by slaops-cli — refreshed autonomously by the relay
    initialAccessKeyId: process.env.RELAY_PLATFORM_SQS_ACCESS_KEY_ID,
    initialSecretAccessKey: process.env.RELAY_PLATFORM_SQS_SECRET_ACCESS_KEY,
    initialSessionToken: process.env.RELAY_PLATFORM_SQS_SESSION_TOKEN,
    initialCredsExpiry: process.env.RELAY_PLATFORM_SQS_CREDS_EXPIRY,
  },

  cognito: {
    identityPoolId: process.env.RELAY_COGNITO_IDENTITY_POOL_ID,
    region: process.env.RELAY_COGNITO_REGION ?? 'ap-southeast-2',
    userPoolId: process.env.RELAY_COGNITO_USER_POOL_ID,
    idToken: process.env.RELAY_COGNITO_ID_TOKEN,
    refreshToken: process.env.RELAY_COGNITO_REFRESH_TOKEN,
    clientId: process.env.RELAY_COGNITO_CLIENT_ID,
    domain: process.env.RELAY_COGNITO_DOMAIN ?? 'https://auth.slaops.com',
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
