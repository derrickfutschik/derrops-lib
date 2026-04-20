---
title: Sign Up and Log In
sidebar_position: 2
description: Create an SLAOps account and explore the Portal for the first time.
tags:
  - quickstart
  - portal
  - authentication
---

# Sign Up and Log In

This guide walks you through creating an SLAOps account and navigating the Portal for the first time.

**Time to complete**: ~5 minutes

---

## Step 1 — Create an account

1. Go to [slaops.com](https://slaops.com) and click **Get started**.
2. Enter your email address and choose a password, then click **Sign up**.
3. Check your inbox for a verification email and click the confirmation link.

:::tip Already have an account?
Skip to [Step 2](#step-2--log-in-to-the-portal).
:::

---

## Step 2 — Log in to the Portal

1. Go to [app.slaops.com](https://app.slaops.com).
2. Enter your email and password, then click **Sign in**.

You will land on the Portal home page.

---

## Step 3 — Explore the Portal

The Portal is organised into several sections accessible from the left sidebar:

| Section           | Purpose                                                  |
| ----------------- | -------------------------------------------------------- |
| **API Tester**    | Send HTTP requests through a relay and inspect results   |
| **Monitoring**    | View live and historical SLA metrics for your APIs       |
| **Cost Analysis** | Break down API usage and cost by operation               |
| **Alerts**        | Configure SLA threshold alerts and notification channels |
| **Relay**         | Manage relay connections (add, view status, remove)      |
| **Settings**      | Account details, team members, API keys, BYOK            |

---

## Step 4 — Retrieve your API key

Some integrations (self-hosted relay, Aegis) need a platform API key.

1. In the Portal, open **Settings → API Keys**.
2. Click **Generate key**.
3. Copy the key and store it securely — it is only shown once.

:::caution
Treat your API key like a password. Do not commit it to source control. Use environment variables or a secrets manager to pass it to your services.
:::

---

## What's next

With your account ready, connect a relay so the Portal can route requests to your services:

- **Local development** → [Local relay quickstart](./local-relay)
- **Staging or production** → [Cloud relay quickstart](./cloud-relay)
