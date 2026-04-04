---
title: Local Relay
sidebar_position: 3
description: Run a relay on your machine to test localhost services from the SLAOps Portal.
tags:
  - quickstart
  - relay
  - local-dev
---

# Local Relay Quickstart

A local relay runs on your machine and lets the SLAOps Portal reach services on `localhost`. This is the fastest way to start using SLAOps during development — no cloud deployment required.

**Time to complete**: ~10 minutes

**Prerequisites**:
- An SLAOps account ([sign up](./portal-login) if you haven't yet)
- Node.js 22 or later
- `npm` or `pnpm`

---

## How it works

The local relay polls a dedicated SQS queue for jobs. When you send a request from the Portal, it is enqueued; the relay picks it up, executes the HTTP call against your local service, and returns the result. All traffic is outbound-only from your machine — no inbound ports are opened.

```
Portal → SLAOps cloud → SQS queue → Local relay → localhost:PORT
```

---

## Step 1 — Install the CLI

```bash
npm install -g slaops-cli
# or
pnpm add -g slaops-cli
```

Verify the install:

```bash
slaops --version
```

---

## Step 2 — Initialise the relay

Run the init command. This opens a browser for authentication and registers a `local-dev` relay with the platform.

```bash
slaops relay init
```

You will see:

```
  Platform URL [https://api.slaops.com]:

  Opening browser for authentication...
  If the browser does not open, visit:
  https://auth.slaops.com/oauth2/authorize?...

  ✓ Authenticated
  ✓ Registering local relay with https://api.slaops.com...
  ✓ Registered (relay_id: abc-123)
  ✓ Config saved to ~/.slaops/config
  ✓ Credentials saved to ~/.slaops/credentials

  Run 'slaops relay start' to connect.
```

What happens during init:

- You authenticate via browser OAuth (PKCE — no password is stored locally).
- The platform provisions a dedicated SQS queue for your relay.
- Non-sensitive configuration is saved to `~/.slaops/config`.
- Short-lived Cognito tokens are saved to `~/.slaops/credentials` (valid 30 days).

No AWS credentials are stored. Temporary AWS credentials are obtained at runtime and kept in memory only.

---

## Step 3 — Start the relay

```bash
slaops relay start
```

Expected output:

```
  ✓ Local relay starting (relay_id: abc-123) [profile: default]
  ✓ Connecting via SQS → https://sqs.ap-southeast-2.amazonaws.com/...

  Target localhost services are now reachable from the SLAOps API Tester.
  Press Ctrl+C to stop.
```

Leave this terminal open. The relay polls continuously for incoming jobs.

---

## Step 4 — Send your first request

1. Open the **SLAOps Portal** and navigate to **API Tester**.
2. Select your relay from the relay picker (it will appear as a `local-dev` relay with a **Local** badge).
3. Enter a target URL, for example `http://localhost:3001/health`.
4. Click **Send**.

The Portal routes the request through your relay to your local service and displays the response, timing, and SLA metrics.

:::note
If you enter a `localhost` URL but no local relay is selected, the Portal will prompt you: *"Your target is a localhost URL. Start a local relay with `slaops relay start` to route this request."*
:::

---

## Managing sessions

**Token expiry**: Your credentials are valid for 30 days. When they expire, re-authenticate:

```bash
slaops relay init
```

Or force re-authentication before expiry:

```bash
slaops relay init --force
```

---

## Multiple environments

Use profiles to run relays for different SLAOps tenants or environments simultaneously.

```bash
# Register a relay against a staging environment
slaops relay init --profile staging --platform-url https://api.staging.slaops.com

# Start the staging relay in a separate terminal
slaops relay start --profile staging
```

Profiles are stored in separate sections of `~/.slaops/config` and `~/.slaops/credentials`, following the same convention as the AWS CLI.

---

## Configuration files

| File | Contents | Permissions |
|---|---|---|
| `~/.slaops/config` | Platform URL, relay ID, SQS queue URL, Cognito settings | `0644` |
| `~/.slaops/credentials` | Short-lived Cognito tokens | `0600` |

Example `~/.slaops/config`:

```toml
[default]
platform_url = "https://api.slaops.com"
relay_id = "abc-123"
relay_sqs_queue_url = "https://sqs.ap-southeast-2.amazonaws.com/123456789/slaops-acme-local-abc123-relay456"
relay_sqs_region = "ap-southeast-2"
identity_pool_id = "ap-southeast-2:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
cognito_region = "ap-southeast-2"
user_pool_id = "ap-southeast-2_XXXXXXXXX"
```

---

## Troubleshooting

**Browser did not open during `relay init`**

Copy the URL printed in the terminal and open it manually.

**`slaops relay start` says credentials are expired**

Run `slaops relay init` to re-authenticate. Your relay ID and configuration are preserved.

**Requests time out in the Portal**

Make sure the relay process is still running in your terminal. The relay must stay running while you use the API Tester.

**Target service is not responding**

Verify your local service is running (`curl http://localhost:PORT/health`) before sending through the Portal. The relay executes the request from your machine, so the service must be reachable from localhost.

---

## What's next

- **Deploy to staging or production** → [Cloud relay quickstart](./cloud-relay)
- **Add credential injection and request policies** → [Aegis quickstart](./aegis)
- **Index your OpenAPI specs** → [OASpec Bucket](/docs/oaspec-bucket)
