---
title: Aegis
sidebar_position: 5
description: Set up the Aegis policy engine for credential injection and request authorisation.
tags:
  - quickstart
  - aegis
  - security
  - credentials
---

# Aegis Quickstart

Aegis is the SLAOps policy engine. It runs in your infrastructure and gives you control over what the relay is allowed to do — without any of your credentials or secrets ever leaving your environment.

**Time to complete**: ~20 minutes

**Prerequisites**:
- A relay already running ([local relay](./local-relay) or [cloud relay](./cloud-relay))
- Docker
- Your SLAOps API key (from Portal → Settings → API Keys)

---

## What Aegis does

When a user starts an API testing session in the Portal, Aegis is called once to decide whether the session is allowed. If it is, Aegis issues a **session delegation JWT** — a short-lived token that the relay validates on every job it processes.

This gives you three things:

| Capability | What it means |
|---|---|
| **Credential injection** | Aegis resolves secrets from your vault (environment variables, AWS Secrets Manager, HashiCorp Vault) and injects them into requests at execution time. No secrets reach the Portal. |
| **Request authorisation** | Cedar-based policies define exactly which endpoints each user or group is allowed to call, and with which methods. |
| **Audit trail** | Every authorisation decision is logged in your environment. |

Aegis is optional for `local-dev` relays. For production deployments handling sensitive APIs it is strongly recommended.

---

## How the authorisation flow works

```
Browser → Portal: "I want to start a session with relay X"
Portal → Aegis:   "Should user alice@acme.com be granted a session?"
Aegis  → Portal:  Session delegation JWT (signed by Aegis private key)
Portal → Relay:   Job + vendor JWT + delegation JWT
Relay  → Aegis:   (none — verifies JWT locally using Aegis public key)
```

Aegis is in the critical path **once per session**, not once per request. After the session is established, the relay validates the embedded JWT locally with zero round trips.

---

## Step 1 — Generate an Aegis signing key pair

Aegis uses an asymmetric key pair to sign session delegation JWTs. The relay holds the public key and can verify JWTs offline.

```bash
# Generate a 2048-bit RSA key pair
openssl genrsa -out aegis-private.pem 2048
openssl rsa -in aegis-private.pem -pubout -out aegis-public.pem
```

Store `aegis-private.pem` securely (for example in AWS Secrets Manager or HashiCorp Vault). You will provide `aegis-public.pem` to the relay.

:::caution Keep the private key secure
Anyone with the private key can issue valid session delegation JWTs. Rotate the key pair if it is ever compromised.
:::

---

## Step 2 — Configure your policies

Aegis uses [Cedar Policy](https://www.cedarpolicy.com) for authorisation. Create a `policies/` directory with at least one policy file.

**Allow all users in the `platform-engineers` group to call any API:**

```cedar
// policies/platform-engineers.cedar
permit (
  principal in UserGroup::"platform-engineers",
  action == Action::"callApi",
  resource == ApiHost::"*"
);
```

**Allow read-only access to a specific host for a broader group:**

```cedar
// policies/readonly-staging.cedar
permit (
  principal in UserGroup::"developers",
  action == Action::"callApiReadOnly",
  resource == ApiHost::"staging.internal.example.com"
);
```

**Restrict production access to a specific user:**

```cedar
// policies/alice-production.cedar
permit (
  principal == User::"alice@acme.com",
  action == Action::"callApi",
  resource == ApiHost::"api.production.example.com"
);
```

Cedar uses **default deny** — unless a `permit` policy explicitly matches a request, the session is denied. Start with permissive policies and tighten them as needed.

See [Aegis Cedar Policy design](/design/cloud-relay/aegis-cedar-policy) for the full entity model and action hierarchy.

---

## Step 3 — Run Aegis

```bash
docker run -d \
  --name slaops-aegis \
  --restart unless-stopped \
  -e AEGIS_PLATFORM_API_KEY=<your-slaops-api-key> \
  -e AEGIS_SIGNING_KEY_PATH=/keys/aegis-private.pem \
  -e AEGIS_IDP_ISSUER=https://your-idp.example.com \
  -e AEGIS_IDP_AUDIENCE=slaops \
  -v $(pwd)/aegis-private.pem:/keys/aegis-private.pem:ro \
  -v $(pwd)/policies:/policies:ro \
  -p 3200:3200 \
  slaops/aegis:latest
```

**Environment variables**:

| Variable | Required | Description |
|---|---|---|
| `AEGIS_PLATFORM_API_KEY` | Yes | Your SLAOps API key — used to verify vendor JWTs |
| `AEGIS_SIGNING_KEY_PATH` | Yes | Path to the private key PEM file (inside the container) |
| `AEGIS_IDP_ISSUER` | Yes | OIDC issuer URL for your identity provider |
| `AEGIS_IDP_AUDIENCE` | Yes | Expected `aud` claim in user tokens |
| `AEGIS_POLICY_DIR` | No | Directory containing `.cedar` policy files (default: `/policies`) |
| `AEGIS_PORT` | No | Port to listen on (default: `3200`) |
| `AEGIS_LOG_LEVEL` | No | `debug`, `info`, `warn`, `error` (default: `info`) |

Check the logs to confirm startup:

```bash
docker logs slaops-aegis
```

Expected output:

```
[Aegis] Loaded 3 policies from /policies
[Aegis] Listening on :3200
[Aegis] Ready
```

---

## Step 4 — Connect Aegis to your relay

Update your relay to require Aegis authorisation and to trust JWTs signed by your Aegis instance.

Add the following environment variables to your relay container:

```bash
AEGIS_URL=http://slaops-aegis:3200   # URL of your Aegis service
AEGIS_PUBLIC_KEY_PATH=/keys/aegis-public.pem   # Path to the public key PEM
AEGIS_REQUIRED=true                  # Reject jobs without a valid delegation JWT
```

Mount the public key into the relay container:

```bash
docker run -d \
  --name slaops-relay \
  -e RELAY_API_KEY=<relay-api-key> \
  -e RELAY_PLATFORM_TOKEN=<relay-platform-token> \
  -e RELAY_PLATFORM_URL=https://api.slaops.com \
  -e RELAY_DELIVERY_MODE=platform-queue \
  -e AEGIS_URL=http://slaops-aegis:3200 \
  -e AEGIS_PUBLIC_KEY_PATH=/keys/aegis-public.pem \
  -e AEGIS_REQUIRED=true \
  -v $(pwd)/aegis-public.pem:/keys/aegis-public.pem:ro \
  slaops/relay:latest
```

---

## Step 5 — Register Aegis in the Portal

Tell the Portal where to send session grant requests.

1. In the Portal, open **Settings → Aegis**.
2. Click **Add Aegis instance**.
3. Enter the URL where your Aegis service is accessible from the SLAOps cloud (e.g. `https://aegis.internal.example.com`).
4. Click **Save**.
5. Associate the Aegis instance with your relay under **Relay → Connections → Edit**.

The Portal will now call your Aegis instance at the start of each session.

---

## Step 6 — Test the integration

1. In the Portal, navigate to **API Tester**.
2. Select the relay connected to Aegis.
3. Enter a target URL covered by your policies.
4. Click **Send**.

If the request succeeds, Aegis authorised the session. If it is blocked, check the Aegis logs:

```bash
docker logs slaops-aegis
```

A denial will look like:

```
[Aegis] DENY user=alice@acme.com action=callApi resource=api.production.example.com
[Aegis] No permit policy matched. Decision: deny.
```

---

## Docker Compose example

```yaml
# docker-compose.yml
services:
  slaops-aegis:
    image: slaops/aegis:latest
    restart: unless-stopped
    environment:
      AEGIS_PLATFORM_API_KEY: ${SLAOPS_API_KEY}
      AEGIS_SIGNING_KEY_PATH: /keys/aegis-private.pem
      AEGIS_IDP_ISSUER: https://your-idp.example.com
      AEGIS_IDP_AUDIENCE: slaops
    volumes:
      - ./aegis-private.pem:/keys/aegis-private.pem:ro
      - ./policies:/policies:ro
    ports:
      - "3200:3200"

  slaops-relay:
    image: slaops/relay:latest
    restart: unless-stopped
    depends_on:
      - slaops-aegis
    environment:
      RELAY_API_KEY: ${RELAY_API_KEY}
      RELAY_PLATFORM_TOKEN: ${RELAY_PLATFORM_TOKEN}
      RELAY_PLATFORM_URL: https://api.slaops.com
      RELAY_DELIVERY_MODE: platform-queue
      AEGIS_URL: http://slaops-aegis:3200
      AEGIS_PUBLIC_KEY_PATH: /keys/aegis-public.pem
      AEGIS_REQUIRED: "true"
    volumes:
      - ./aegis-public.pem:/keys/aegis-public.pem:ro
```

---

## Credential injection

Aegis can inject secrets into requests so that credentials are never entered in the Portal. Use secret template syntax in your API Tester requests:

| Template | Where the secret comes from |
|---|---|
| `{{secret:env:MY_API_KEY}}` | Environment variable on the relay |
| `{{secret:aws-secrets-manager:my-secret/api-key}}` | AWS Secrets Manager |
| `{{secret:vault:secret/data/my-api}}` | HashiCorp Vault |

For example, to inject a bearer token into the `Authorization` header:

```
Authorization: Bearer {{secret:aws-secrets-manager:production/stripe/api-key}}
```

Aegis resolves the secret at session grant time and embeds it in the relay job. The Portal user never sees the secret value.

---

## Troubleshooting

**Session denied immediately**

- Check that a `permit` policy covers the user's group membership, action, and target host.
- Confirm the IdP issuer and audience in the Aegis config match the claims in the user's token.
- Enable debug logging: set `AEGIS_LOG_LEVEL=debug` for detailed evaluation output.

**Relay rejects jobs with "missing delegation JWT"**

- Confirm Aegis is registered in the Portal for the relay's connection.
- Check the Aegis service is reachable from the Portal's perspective.
- If testing without Aegis, set `AEGIS_REQUIRED=false` on the relay temporarily.

**Key pair mismatch errors**

- The relay's `aegis-public.pem` must correspond to the Aegis service's `aegis-private.pem`.
- Regenerate the key pair and update both services if they are out of sync.

---

## What's next

- **Index your OpenAPI specs** → [OASpec Bucket](/docs/oaspec-bucket)
- **Understand the full security model** → [Architecture Planes](/docs/archiecture-planes)
- **Advanced policy patterns** → [Aegis Cedar Policy design](/design/cloud-relay/aegis-cedar-policy)
- **Bring your own encryption key** → [BYOK](/docs/byok)
