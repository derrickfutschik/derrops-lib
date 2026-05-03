---
title: Cloud Relay
sidebar_position: 4
description: Deploy a relay in your cloud environment or use the Derrops-managed option.
tags:
  - quickstart
  - relay
  - cloud
  - docker
---

# Cloud Relay Quickstart

A cloud relay runs in your infrastructure and lets the Derrops Portal reach services in your cloud environment — including private VPC endpoints that are not accessible from the internet.

**Time to complete**: ~20 minutes

**Prerequisites**:

- An Derrops account and API key ([Portal login guide](./portal-login))
- Docker (for self-hosted) or access to your cloud environment

---

## Delivery modes

Before deploying, choose the delivery mode that fits your network:

| Mode               | How it works                                     | Use when                               |
| ------------------ | ------------------------------------------------ | -------------------------------------- |
| **Managed**        | Derrops-hosted Lambda, no infrastructure required | You want zero-ops setup                |
| **Direct**         | Derrops calls your relay synchronously over HTTPS | Your relay is publicly reachable       |
| **Platform-queue** | Your relay polls Derrops for jobs (outbound-only) | Your relay is behind a NAT or firewall |

The platform-queue mode is the most flexible — your relay never accepts inbound connections, so it works behind firewalls and in private subnets.

---

## Option A — Managed relay (no infrastructure)

A managed relay is a Derrops-hosted Lambda function. Derrops provides and operates the infrastructure; you only configure it.

1. In the Portal, open **Relay → Add connection**.
2. Select **Managed**.
3. Give the relay a name (e.g. `production`).
4. Click **Create**.

The relay will show as **Connected** once it is provisioned (typically under a minute).

:::note
Managed relays egress from a fixed set of Derrops IP addresses. Contact support for the current egress IP list if you need to allowlist them in your firewall.
:::

---

## Option B — Self-hosted with Docker

Deploy the relay in your own environment using the official Docker image.

### 1. Obtain relay credentials from the Portal

1. In the Portal, open **Relay → Add connection**.
2. Select **Self-hosted**.
3. Choose a delivery mode: **Direct** or **Platform-queue**.
4. Give the relay a name and click **Create**.
5. Copy the `RELAY_API_KEY` and `RELAY_PLATFORM_TOKEN` shown — they are only displayed once.

### 2. Run the relay container

Replace the placeholder values with your credentials from the Portal.

```bash
docker run -d \
  --name derrops-relay \
  --restart unless-stopped \
  -e RELAY_API_KEY=<your-relay-api-key> \
  -e RELAY_PLATFORM_TOKEN=<your-relay-platform-token> \
  -e RELAY_PLATFORM_URL=https://api.derrops.com \
  -e RELAY_DELIVERY_MODE=platform-queue \
  -p 3100:3100 \
  derrops/relay:latest
```

**Environment variables**:

| Variable               | Required | Description                                                        |
| ---------------------- | -------- | ------------------------------------------------------------------ |
| `RELAY_API_KEY`        | Yes      | Validates inbound calls from Derrops (direct mode only)             |
| `RELAY_PLATFORM_TOKEN` | Yes      | Bearer token for outbound calls to Derrops                          |
| `RELAY_PLATFORM_URL`   | Yes      | Derrops control plane URL                                           |
| `RELAY_DELIVERY_MODE`  | Yes      | `direct`, `relay-queue`, or `platform-queue`                       |
| `RELAY_PORT`           | No       | Port to listen on (default: `3100`)                                |
| `AEGIS_URL`            | No       | URL of your Aegis instance (if using Aegis)                        |
| `AEGIS_REQUIRED`       | No       | Set to `true` to require Aegis for all requests (default: `false`) |

### 3. Verify the connection

Check the relay logs:

```bash
docker logs derrops-relay
```

You should see:

```
[Relay] Starting relay in platform-queue mode
[Relay] Polling https://api.derrops.com/cloud-relay/queue/next
[Relay] Connected
```

In the Portal, the relay should show **Connected** under **Relay → Connections**.

---

## Option C — Docker Compose

For local staging environments or multi-service setups, use Docker Compose.

```yaml
# docker-compose.yml
services:
  derrops-relay:
    image: derrops/relay:latest
    restart: unless-stopped
    environment:
      RELAY_API_KEY: ${RELAY_API_KEY}
      RELAY_PLATFORM_TOKEN: ${RELAY_PLATFORM_TOKEN}
      RELAY_PLATFORM_URL: https://api.derrops.com
      RELAY_DELIVERY_MODE: platform-queue
    ports:
      - '3100:3100'

  # Your application service — relay can reach it via service name
  my-api:
    image: my-company/my-api:latest
    ports:
      - '3001:3001'
```

```bash
# Create a .env file with your credentials
echo "RELAY_API_KEY=<your-key>" >> .env
echo "RELAY_PLATFORM_TOKEN=<your-token>" >> .env

docker compose up -d
```

The relay can reach `my-api` using its Docker service name as the hostname (e.g. `http://my-api:3001`).

---

## Option D — AWS Lambda (SAM)

The relay ships with an AWS SAM template for Lambda deployments.

```bash
# Pull the relay package
npm install -g derrops-relay

# Deploy using SAM
derrops-relay deploy \
  --stack-name derrops-relay-prod \
  --relay-api-key <your-relay-api-key> \
  --relay-platform-token <your-relay-platform-token> \
  --delivery-mode platform-queue \
  --region ap-southeast-2
```

The Lambda function is deployed behind API Gateway. The deployment prints the relay endpoint URL — use it when configuring the connection in the Portal if using direct mode.

---

## Send your first request

1. Open the Portal and navigate to **API Tester**.
2. Select your newly added relay from the relay picker.
3. Enter a target URL accessible from your relay's network (e.g. `https://internal.example.com/health`).
4. Click **Send**.

---

## Troubleshooting

**Relay shows Disconnected in the Portal**

- Check relay logs for authentication errors.
- Confirm `RELAY_PLATFORM_TOKEN` matches the value shown when you created the connection.
- Ensure outbound HTTPS traffic to `api.derrops.com` is permitted by your firewall.

**Requests time out**

- Verify the target service is reachable from the relay's network: `curl http://internal.example.com/health` from inside the container.
- Check for SSRF policy blocks in the relay logs if the target is on a private IP range.

**Direct mode: relay is unreachable**

- Confirm the relay's port is accessible from the internet (or from Derrops IPs).
- For private networks, switch to `platform-queue` delivery mode.

---

## What's next

- **Add credential injection and request policies** → [Aegis quickstart](./aegis)
- **Index your OpenAPI specs** → [OASpec Bucket](/docs/oaspec-bucket)
- **Set up SLA monitoring** → Portal → Monitoring
