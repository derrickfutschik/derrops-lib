# slaops-cli

oclif-based CLI (`slaops`) that lets developers register and run a local relay, routing SLAOps Portal requests to `localhost` services via SQS. Published as `slaops-cli` on npm.

---

## Directory layout

```
apps/slaops-cli/
├── bin/run.js                    # oclif entry point
├── src/
│   ├── commands/
│   │   └── relay/
│   │       ├── init.ts           # slaops relay init
│   │       └── start.ts          # slaops relay start
│   ├── auth/
│   │   └── cognito.ts            # PKCE browser auth, token refresh, Identity Pool creds
│   ├── config-file.ts            # ~/.slaops/config reader/writer (0644)
│   ├── credentials-file.ts       # ~/.slaops/credentials reader/writer (0600)
│   └── profile-store.ts          # TOML-compatible parse/stringify, profile helpers
└── dist/                         # Compiled output (CommonJS)
```

---

## Commands

### `slaops relay init`

Authenticates via Cognito browser PKCE, registers a `local-dev` relay with `slaops-cloud`, and persists configuration.

**Flags**:

| Flag | Default | Description |
|---|---|---|
| `--platform-url` | prompted | slaops-cloud base URL |
| `--profile` / `-p` | `default` | Profile name in `~/.slaops/config` and `~/.slaops/credentials` |
| `--force` / `-f` | `false` | Re-authenticate and overwrite existing credentials |
| `--queue-mode` | `platform` | `platform` — SLAOps provisions the SQS queue; `relay` — customer provisions it |
| `--relay-queue-url` | — | Required when `--queue-mode=relay`; must be an SQS FIFO URL ending in `.fifo` |

**What it does**:
1. Starts a local HTTP server on port 9876 to catch the OAuth callback.
2. Opens the Cognito hosted UI for PKCE auth.
3. Exchanges the auth code for Cognito tokens (`access_token`, `id_token`, `refresh_token`).
4. POSTs to `POST /cloud-relay/connection` with the Bearer access token to register the relay and provision (or validate) an SQS FIFO queue.
5. Writes non-sensitive config to `~/.slaops/config` (mode 0644).
6. Writes Cognito tokens to `~/.slaops/credentials` (mode 0600).

No AWS credentials are stored — they are obtained at relay start via the Identity Pool and held in memory only.

### `slaops relay start`

Exchanges stored Cognito tokens for temporary AWS credentials, then delegates to `slaops-relay`'s `bootstrapRelay()`.

**Flags**:

| Flag | Default | Description |
|---|---|---|
| `--profile` | `default` | Must match a profile in `~/.slaops/config` and `~/.slaops/credentials` |

**What it does**:
1. Reads `~/.slaops/config` and `~/.slaops/credentials` for the given profile.
2. If the Cognito access token is expired (within 60s buffer), calls `refreshAccessToken()` and writes the refreshed tokens back to `~/.slaops/credentials`.
3. Calls `getAwsCredentialsFromIdentityPool()` — two raw JSON calls to `cognito-identity.<region>.amazonaws.com` (GetId, GetCredentialsForIdentity). No AWS SDK is used.
4. Injects all relay + AWS config into `process.env` (see env vars table below).
5. Calls `bootstrapRelay()` from the `slaops-relay` workspace package (loaded via `require` to avoid circular import issues).

**Env vars injected into the relay process**:

| Variable | Source |
|---|---|
| `RELAY_ID` | `config.relay_id` |
| `RELAY_PLATFORM_URL` | `config.platform_url` |
| `RELAY_PLATFORM_TOKEN` | Cognito `access_token` |
| `RELAY_PLATFORM_SQS_QUEUE_URL` | `config.relay_sqs_queue_url` |
| `RELAY_PLATFORM_SQS_REGION` | `config.relay_sqs_region` |
| `RELAY_PLATFORM_SQS_ACCESS_KEY_ID` | Identity Pool temp creds |
| `RELAY_PLATFORM_SQS_SECRET_ACCESS_KEY` | Identity Pool temp creds |
| `RELAY_PLATFORM_SQS_SESSION_TOKEN` | Identity Pool temp creds |
| `RELAY_PLATFORM_SQS_CREDS_EXPIRY` | Identity Pool temp creds expiry |
| `RELAY_COGNITO_*` | Cognito config + tokens (for relay-side refresh) |
| `RELAY_SSRF_POLICY` | Hardcoded `dev-local` |
| `AEGIS_REQUIRED` | Hardcoded `false` |

---

## Configuration files

| File | Mode | Contents |
|---|---|---|
| `~/.slaops/config` | 0644 | `platform_url`, `relay_id`, `relay_sqs_queue_url`, `relay_sqs_region`, `relay_sqs_queue_mode`, `identity_pool_id`, `cognito_region`, `user_pool_id` |
| `~/.slaops/credentials` | 0600 | `access_token`, `id_token`, `refresh_token`, `expires_at` |

Both files use a TOML-compatible `[profile]` section format, mirroring AWS CLI conventions. The parser/writer is implemented in `profile-store.ts` with no external dependencies.

---

## Auth module (`src/auth/cognito.ts`)

Three exports used by the commands:

| Export | Purpose |
|---|---|
| `authenticateWithBrowser()` | Full PKCE flow — starts local server on port 9876, opens browser, returns `CognitoTokens` |
| `refreshAccessToken(refreshToken)` | Calls `POST /oauth2/token` with `grant_type=refresh_token`; returns new access + id tokens |
| `getAwsCredentialsFromIdentityPool(idToken, opts)` | Raw fetch calls to Cognito Identity (GetId → GetCredentialsForIdentity); returns `AwsTemporaryCredentials` |

Cognito config defaults (overridable via env):

| Env var | Default |
|---|---|
| `SLAOPS_COGNITO_DOMAIN` | `https://auth.slaops.com` |
| `SLAOPS_COGNITO_CLIENT_ID` | _(must be set in release builds)_ |
| `SLAOPS_COGNITO_REGION` | `ap-southeast-2` |
| `SLAOPS_COGNITO_USER_POOL_ID` | _(must be set in release builds)_ |
| `SLAOPS_IDENTITY_POOL_ID` | _(must be set in release builds)_ |

---

## Development

```bash
# From monorepo root
pnpm install --frozen-lockfile

# Build (outputs to dist/)
pnpm --filter slaops-cli run build

# Watch mode
pnpm --filter slaops-cli run dev

# Run directly without publishing
node bin/run.js relay init
node bin/run.js relay start
```

The CLI depends on `slaops-relay` (workspace package) — build it first if relay changes are in flight:

```bash
pnpm --filter slaops-relay run build
pnpm --filter slaops-cli run build
```

---

## Key conventions

- **No AWS SDK** in the CLI itself — `getAwsCredentialsFromIdentityPool` uses `fetch` directly to avoid the package weight. The `@aws-sdk/client-sqs` dependency is `optionalDependencies` and is only used inside `slaops-relay`.
- **No `process.env` for config reads** — Cognito constants are resolved once at module load from `process.env` with compile-time defaults. The `@slaops/config` package is not used here (CLI has no CDK/Amplify config context).
- **TOML parser is bespoke** — `profile-store.ts` handles only the subset needed (`[section]`, `key = "value"`). Do not add complex TOML features; use the existing helpers.
- **Profile parity with AWS CLI** — `default` profile is implicit; named profiles are explicit `[profile-name]` sections. Follow this convention for any new credential-bearing files.

---

## Related docs

- User-facing local relay setup: `apps/slaops-docs/public/docs/quickstart/local-relay.md`
- Cloud relay (Docker / Lambda): `apps/slaops-docs/public/docs/quickstart/cloud-relay.md`
- Relay runtime: `apps/slaops-cloud/src/cloud-relay/` (NestJS service that the relay polls)
