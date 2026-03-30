---
sidebar_position: 6
title: Multi-Tenancy
slug: multi-tenancy
description: How SLAOps isolates your data and resources from other customers, and what dedicated infrastructure you get as a tenant.
tags:
  - Multi-Tenancy
  - Security
  - Data Isolation
---

# Multi-Tenancy

SLAOps is a multi-tenant platform. Every customer gets a **tenant** — a fully isolated slice of the platform with its own dedicated storage, search space, and access controls. Your data is never co-mingled with another customer's data.

---

## What is a Tenant?

A tenant is the unit of isolation in SLAOps. When you sign up, a tenant is provisioned for your organisation. All of your API logs, OpenAPI specifications, metrics, and configuration belong to your tenant and are inaccessible to anyone else.

A single customer account can own multiple tenants (e.g., one per environment, or one per business unit). Each tenant is independent.

---

## What You Get as a Tenant

### Dedicated S3 Buckets

You get two dedicated, private S3 buckets — one for your OpenAPI specifications and one for your log archive. No other tenant has access to these buckets.

| Bucket | Purpose |
|---|---|
| **OASpec bucket** | Stores the OpenAPI specifications you upload to SLAOps. See [OASpec Bucket](./oaspec-bucket) for details. |
| **Log archive bucket** | Long-term storage for your HTTP request logs captured by the SLAOps relay. |

Your buckets are yours. SLAOps uses them to power enrichment and search features, but they are scoped exclusively to your tenant.

### Private OpenAPI Catalogue

In addition to the [SLAOps-managed public catalogue](#slaops-managed-catalogue) of well-known APIs, you get a private search space for OpenAPI specs you upload yourself. When SLAOps enriches your API logs, your private specs are always checked first — they take precedence over the public catalogue.

This means you can:
- Add internal APIs that aren't in any public directory
- Override a public spec with a customised version (e.g., a private staging variant)

See [OASpec Bucket](./oaspec-bucket) for how to upload specs to your tenant.

### Isolated Search Space

Every search query you make — whether from the portal or via enrichment — is scoped to your tenant. Results from other tenants are never returned.

---

## SLAOps-Managed Catalogue

In addition to your private specs, all tenants have read-only access to the SLAOps-managed public catalogue. This catalogue contains thousands of well-known API specifications sourced from [APIs-guru/openapi-directory](https://github.com/APIs-guru/openapi-directory) and curated provider additions (Stripe, AWS, Twilio, and others). It is updated automatically.

You can use the public catalogue without uploading anything. If you upload a spec that overlaps with one in the public catalogue, yours takes precedence.

---

## Data Isolation Guarantee

SLAOps enforces tenant isolation at multiple independent levels:

| Level | What it does |
|---|---|
| **Storage** | Your S3 buckets and OpenSearch index are dedicated to your tenant. Access policies permit only your tenant's credentials. |
| **Network** | All traffic flows through a private VPC. Resources are not publicly accessible. |
| **Authentication** | Every API request is authenticated and your tenant identity is verified before any data is read or written. |
| **Query scoping** | All database and search queries are automatically scoped to your tenant. There is no way to query another tenant's data through the SLAOps API. |

---

## Multi-Environment Tenants

If you run separate environments (production, staging, development), we recommend provisioning a separate tenant per environment. This gives each environment completely isolated storage, logs, and specs, and makes it safe to test changes in staging without any risk to production data.

---

## Related Pages

- [OASpec Bucket](./oaspec-bucket) — uploading and managing your OpenAPI specifications
- [Getting Started](./getting-started) — connecting your first application to SLAOps
- [Plans](./plans) — feature availability and limits by plan tier
