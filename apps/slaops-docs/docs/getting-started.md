---
sidebar_position: 2
title: Getting Started
description: Set up the SLAOps platform, connect a relay, and make your first monitored API request.
---

# Getting Started

SLAOps monitors and tests HTTP APIs across your applications. This guide takes you from a fresh account to your first monitored request in three steps: sign up, connect a relay, and run a test.

---

## How SLAOps works

SLAOps uses a plane-based architecture. Understanding the three main components will help you know what to install and why.

| Component | What it does | Where it runs |
|---|---|---|
| **SLAOps Portal** | Dashboard, API tester, alerting, cost analysis | SLAOps cloud |
| **Relay** | Executes HTTP requests and forwards results back | Your infrastructure or local machine |
| **Aegis** | Policy engine that authorises what the relay can execute | Your infrastructure (optional for local dev) |

When you run an API test in the Portal, SLAOps sends the job to your relay. The relay makes the real HTTP request to your target service and returns the result. This design means:

- **Credentials stay in your environment.** The Portal never touches your API keys or OAuth tokens.
- **Private services are reachable.** A relay deployed inside your VPC can reach endpoints that are not publicly accessible.
- **Local services are reachable.** A relay on your laptop can reach `localhost:3000` during development.

For a deeper dive into the architecture see [Enterprise Plane Architecture](/docs/archiecture-planes).

---

## Prerequisites

- An SLAOps account — [sign up at slaops.com](https://slaops.com)
- Node.js 22 or later
- `pnpm` 8.15 or later (or `npm` / `yarn`)

---

## Step 1 — Install the CLI

The `slaops` CLI manages local relay setup and authentication.

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

## Step 2 — Connect a relay

Choose the path that matches your situation:

### Local development (localhost targets)

Use this when your target service is running on your own machine (e.g. `http://localhost:3001`).

```bash
slaops relay init
```

This opens a browser window for authentication. Sign in with your SLAOps account. The CLI will:

1. Authenticate you via Cognito (PKCE — no password is stored)
2. Register a `local-dev` relay with the platform and provision a dedicated SQS queue
3. Save configuration to `~/.slaops/config` and tokens to `~/.slaops/credentials`

Once initialised, start the relay:

```bash
slaops relay start
```

The relay is now running and connected. Leave this terminal open while you use the Portal.

```
  ✓ Local relay starting (relay_id: abc-123) [profile: default]
  ✓ Connecting via SQS → https://sqs.ap-southeast-2.amazonaws.com/...

  Target localhost services are now reachable from the SLAOps API Tester.
  Press Ctrl+C to stop.
```

**Your session is valid for 30 days.** When the refresh token expires, run `slaops relay init` again.

#### Multiple environments

Use profiles to connect to different tenants or SLAOps environments simultaneously:

```bash
# Register a relay against the staging environment
slaops relay init --profile staging --platform-url https://api.staging.slaops.com

# Start the staging relay
slaops relay start --profile staging
```

Profile config and credentials are stored in separate sections of `~/.slaops/config` and `~/.slaops/credentials`, following the same convention as AWS CLI profiles.

---

### Cloud relay (staging / production)

For services running in your cloud environment, deploy the relay alongside your application and register it through the Portal.

1. **Deploy** `slaops-relay` in your infrastructure (Docker, Lambda, ECS, etc.)
2. In the **Portal → Relay → Add connection**, select your deployment type:
   - **Managed** — SLAOps-hosted Lambda, no infrastructure required
   - **Self-hosted** — your own deployment, direct or queue delivery
3. Configure your relay with the `RELAY_API_KEY` returned by the Portal
4. Verify the connection shows **Connected** in the Portal

---

### Enterprise: relay-owned SQS queue

If your network policy prevents outbound connections to SQS endpoints in the SLAOps account, use `relay` queue mode. You provision the SQS FIFO queue in your own AWS account:

1. Create an SQS FIFO queue in your account (name must end in `.fifo`)
2. Add a resource policy granting the `SlaOpsSqsPublishRole` (shown in Portal settings) `sqs:SendMessage` permission
3. Register with the relay-owned queue:

```bash
slaops relay init \
  --queue-mode relay \
  --relay-queue-url https://sqs.ap-southeast-2.amazonaws.com/YOUR_ACCOUNT/your-queue.fifo
```

SLAOps publishes jobs to your queue cross-account. Your relay consumes using its own IAM credentials.

---

## Step 3 — Run your first test

1. Open the **SLAOps Portal** and navigate to **API Tester**
2. Select your relay from the relay picker
3. Enter a target URL (e.g. `http://localhost:3001/health` for a local service)
4. Click **Send**

The request is routed through your relay. The Portal shows the response, timing, and any SLA metrics.

:::note Local targets
If your target URL starts with `localhost` or `127.0.0.1`, the Portal will remind you to start a local relay with `slaops relay start` if none is active.
:::

---

## Step 4 — Add Aegis (optional)

**Aegis** is the SLAOps policy engine. It runs in your infrastructure and issues short-lived authorisation tokens that the relay requires before executing sensitive requests. Aegis gives you:

- **Credential injection** — Aegis resolves secrets from your own vault and injects them at execution time. Credentials never reach SLAOps.
- **Request authorisation** — define policies that restrict what endpoints the relay can call, what headers it can send, and which users can trigger executions.
- **Audit trail** — every execution decision is logged in your environment.

Aegis is optional for `local-dev` relays. For production deployments handling sensitive APIs it is strongly recommended.

To configure Aegis, see the [Aegis quickstart](/docs/quickstart/aegis).

---

## What's next

| Goal | Where to go |
|---|---|
| Monitor API SLAs and set alerts | Portal → Monitoring |
| Index your OpenAPI specifications | [OASpec Bucket](/docs/oaspec-bucket) |
| Understand costs per API operation | Portal → Cost Analysis |
| Deploy to production with Aegis | [Aegis quickstart](/docs/quickstart/aegis) |
| Bring your own encryption key | [BYOK](/docs/byok) |
| Review platform architecture | [Enterprise Plane Architecture](/docs/archiecture-planes) |
| Look up a term | [Glossary](/docs/glossary) |
