/**
 * Typed accessor for environment variables.
 * All configuration in slaops-aegis comes from process.env — no @slaops/config
 * dependency so Aegis can be deployed independently as a customer-controlled service.
 */
export const env = {
  port: parseInt(process.env.AEGIS_PORT ?? '3003', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  signing: {
    /**
     * JWK JSON string for the Aegis signing private key.
     * Customer-generated and customer-held. Used to sign session delegation JWTs.
     * If unset, an ephemeral key is generated at startup (development only).
     */
    keyJwk: process.env.AEGIS_SIGNING_KEY,
    /** Key ID (`kid`) for the active signing key. Must match the JWKS entry Aegis publishes. */
    keyId: process.env.AEGIS_SIGNING_KEY_ID ?? 'aegis-1',
    /** Issuer claim placed in session delegation JWTs. Should be the Aegis public URL. */
    issuer: process.env.AEGIS_ISSUER ?? 'https://aegis.example.com',
    /** TTL for session delegation JWTs (seconds). */
    sessionTtlS: parseInt(process.env.AEGIS_SESSION_TTL_S ?? String(30 * 60), 10),
  },

  idp: {
    /**
     * JWKS endpoint of the customer SSO IdP.
     * Used to validate user tokens submitted at session-start.
     * If unset, IdP token validation is skipped (development only).
     */
    jwksUrl: process.env.CUSTOMER_IDP_JWKS_URL,
  },

  platform: {
    /** Base URL of the SLAOps platform. Used for the registration handshake. */
    url: process.env.SLAOPS_PLATFORM_URL,
    /**
     * One-time registration token issued by the portal when the Aegis instance was created.
     * Aegis posts this to the platform at startup to complete the registration handshake.
     * After a successful handshake this token is no longer usable.
     */
    registrationToken: process.env.SLAOPS_REGISTRATION_TOKEN,
  },

  relay: {
    /**
     * Comma-separated list of relay UUIDs Aegis will issue delegation JWTs for.
     * Requests scoping a relay ID not in this list are rejected.
     * Requires a restart to update.
     */
    allowedIds: (process.env.ALLOWED_RELAY_IDS ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  },

  cedar: {
    /**
     * Directory containing Cedar policy files (.cedar) and schema.json.
     * Customer-managed; Aegis reads all .cedar files in this directory at startup.
     * Defaults to ./policies relative to the process working directory.
     */
    policiesDir: process.env.CEDAR_POLICIES_DIR ?? './policies',
  },
} as const
