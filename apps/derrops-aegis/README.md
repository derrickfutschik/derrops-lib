# @derrops/aegis

Customer-controlled session delegation and authorization broker for the Derrops relay network. Validates user identity via the customer SSO IdP, evaluates policy, and issues session delegation JWTs consumed by the Derrops relay agents.

Aegis runs entirely within the customer's infrastructure — the signing keys never leave the customer's environment.

## Design

See the [Cloud Relay Component Design](/notes/proposals/cloud-relay/component-cloud-relay.md) and [Aegis Token Broker Design](../derrops-docs/notes/proposals/cloud-relay/aegis-token-broker-design.md) for the full architecture, sequence diagrams, and design decisions.

## Overview

The Aegis broker is the trust anchor for the customer side of the dual-authorization model:

1. A user authenticates with the customer's identity provider (IdP).
2. The client presents the IdP token to Aegis (`POST /v1/session`).
3. Aegis validates the token, evaluates entitlement policy, and issues a signed session delegation JWT.
4. The relay agent validates the session JWT (via Aegis's JWKS) alongside the platform vendor JWT before executing any job.

## Features

- ES256 session delegation JWT issuance (customer-signed, relay-scoped)
- JWKS endpoint (`/.well-known/jwks.json`) for downstream JWT validation
- Customer IdP token validation (OpenID Connect JWKS)
- Config-driven relay allowlisting via `ALLOWED_RELAY_IDS`
- Session revocation (in-memory JTI tracking)
- One-time registration handshake with Derrops platform at startup
- Deployable as Express server or AWS Lambda

## Quick Start

### Prerequisites

- Node.js >= 22.0.0
- pnpm 8.15.4+
- A registration token from the Derrops platform (for production)

### Installation

```bash
# From monorepo root
pnpm install
```

### Configuration

Create a `.env` file:

```env
# Server
AEGIS_PORT=3003
NODE_ENV=development

# Signing key — if unset, an ephemeral ES256 key is generated at startup (dev only)
# In production, generate with: node -e "const {generateKeyPairSync}=require('crypto'); ..."
AEGIS_SIGNING_KEY={"kty":"EC","crv":"P-256",...}
AEGIS_SIGNING_KEY_ID=aegis-1

# JWT claims
AEGIS_ISSUER=https://aegis.your-company.com
AEGIS_SESSION_TTL_S=1800

# Customer IdP — JWKS endpoint for validating user tokens
# Leave unset in dev to skip IdP validation
CUSTOMER_IDP_JWKS_URL=https://your-idp.example.com/.well-known/jwks.json

# Relay allowlist — comma-separated relay UUIDs this Aegis is authorised to delegate to
ALLOWED_RELAY_IDS=relay-uuid-1,relay-uuid-2

# Platform registration (optional — skip if not registering with Derrops)
DERROPS_PLATFORM_URL=https://api.derrops.com
DERROPS_REGISTRATION_TOKEN=<one-time-token-from-platform>
```

### Running the App

```bash
# Development mode with hot reload
pnpm --filter @derrops/aegis run start:dev

# Production mode
pnpm --filter @derrops/aegis run start:prod
```

## Module Structure

```
src/
├── app.module.ts                       # Root module — all feature modules
├── main.ts                             # Express/HTTP server bootstrap (port AEGIS_PORT)
├── lambda.ts                           # AWS Lambda handler
├── env.ts                              # Typed environment variable config
│
├── session/                            # Session delegation JWT issuance
│   ├── session.module.ts
│   ├── session.controller.ts           # POST /v1/session, DELETE /v1/session/:jti
│   ├── session.service.ts              # Token validation, policy eval, JWT signing
│   └── dto/
│       ├── request-session.dto.ts      # userToken, tenantId, requestedScopes
│       └── session-response.dto.ts     # sessionJwt, expiresAt, grantedScopes
│
├── jwks/                               # Signing key management
│   ├── jwks.module.ts
│   ├── jwks.controller.ts              # GET /.well-known/jwks.json
│   └── signing-key.service.ts          # ES256 key load/generate, signJwt(), getJwks()
│
├── entitlement/                        # Access policy evaluation
│   ├── entitlement.module.ts
│   ├── entitlement.controller.ts       # GET /v1/entitlement?userId=&tenantId=
│   └── entitlement.service.ts          # Config-driven (Stage 1); DB-backed in roadmap
│
└── registration/                       # Platform registration handshake
    ├── registration.module.ts
    └── registration.service.ts         # OnModuleInit: POST <platformUrl>/cloud-relay/aegis/register
```

## API Endpoints

| Method   | Path                     | Description                         |
| -------- | ------------------------ | ----------------------------------- |
| `GET`    | `/.well-known/jwks.json` | Public signing key in JWKS format   |
| `POST`   | `/v1/session`            | Issue a session delegation JWT      |
| `DELETE` | `/v1/session/:jti`       | Revoke a session JWT by JTI         |
| `GET`    | `/v1/entitlement`        | Query relay entitlements for a user |

### POST /v1/session

**Request:**

```json
{
  "tenantId": "tenant-uuid",
  "userToken": "<idp-issued-jwt>",
  "requestedScopes": [{ "apiId": "api-uuid", "environment": "production", "relayId": "relay-uuid" }]
}
```

**Response (201):**

```json
{
  "sessionJwt": "<signed-delegation-jwt>",
  "expiresAt": "2026-03-24T13:30:00Z",
  "grantedScopes": [
    {
      "relayIds": ["relay-uuid"],
      "allowedMethods": ["GET", "POST", "PUT", "PATCH", "DELETE"],
      "pathPatterns": ["**"]
    }
  ],
  "deniedScopes": []
}
```

## Registration Flow

When `DERROPS_PLATFORM_URL` and `DERROPS_REGISTRATION_TOKEN` are both set, Aegis performs a one-time handshake with the Derrops platform at startup:

1. `POST <DERROPS_PLATFORM_URL>/cloud-relay/aegis/register` with `{ registrationToken, jwksUrl }`
2. Platform verifies the token, transitions the Aegis instance from `pending` → `active`, and clears the token.
3. The relay network can now discover this Aegis instance's JWKS for session JWT validation.

After successful registration, remove `DERROPS_REGISTRATION_TOKEN` from your environment.

## Security Model

- **Customer-held signing keys** — The private key supplied in `AEGIS_SIGNING_KEY` never leaves your infrastructure.
- **Dual authorization** — The relay requires a valid platform vendor JWT _and_ a valid Aegis session JWT. Compromising one side alone is insufficient.
- **Relay allowlist** — `ALLOWED_RELAY_IDS` restricts which relay agents this Aegis instance will delegate to.
- **Short-lived sessions** — Default TTL is 30 minutes (`AEGIS_SESSION_TTL_S=1800`).
- **Session revocation** — Issued JTIs can be revoked in-memory via `DELETE /v1/session/:jti`.

## Deployment

### As a Docker Container / VM

Set environment variables and run the Express server. The JWKS URL (`AEGIS_ISSUER + /.well-known/jwks.json`) must be reachable by the relay agents.

### As an AWS Lambda

The `lambdaHandler` export wraps NestJS with `@codegenie/serverless-express`. Deploy via your preferred IaC tooling and expose through API Gateway.

## Development

### Build

```bash
pnpm --filter @derrops/aegis run build
```

### Tests

```bash
pnpm --filter @derrops/aegis run test
pnpm --filter @derrops/aegis run test:watch
```

### Swagger UI

When running locally, visit `http://localhost:3003/api` for the interactive API documentation.

## Roadmap

- **Stage 2**: Database-backed entitlement policies for per-user, per-path authorization
- **Stage 2**: Persistent session storage and audit logging
- **Stage 2**: Admin API for managing relay allowlists and entitlement rules
- **Stage 2**: Deployment CDK/Amplify stack for one-click customer installation
