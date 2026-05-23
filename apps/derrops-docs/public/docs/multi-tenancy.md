---
sidebar_position: 6
title: Multi-Tenancy
slug: multi-tenancy
description: Multi-tenancy design and implementation on the platform.
tags:
  - Multi-Tenancy
  - Security
  - Data Isolation
---

# Multi-Tenancy

Derrops is a multi-tenant platform. Every customer gets a **tenant** — a fully isolated slice of the platform with its own dedicated storage, search space, and access controls. Your data is never co-mingled with another customer's data.

---

## What is a Tenant?

A tenant is the unit of isolation in Derrops. When you sign up, a tenant is provisioned for your organisation. All of your API logs, OpenAPI specifications, metrics, and configuration belong to your tenant and are inaccessible to anyone else.

### Customers, Users, and Tenants

These three concepts are distinct:

| Concept      | Description                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **Customer** | An organisation or individual with a Derrops account.                                                       |
| **User**     | A person who authenticates with Derrops. Every user belongs to exactly one customer.                        |
| **Tenant**   | An isolated data environment. A customer may own many tenants (e.g., one per environment or business unit). |

A user's session is always scoped to a single tenant — not to the customer as a whole. A user can access any of their customer's tenants, but must sign in to each one separately; a single session cannot span multiple tenants.

### Tenant ID Format

Every tenant is identified by a **tenant ID** — a short, opaque string with the following structure:

```
t-<8 alphanumeric characters>
```

Examples: `t-acme0001`, `t-glbl0000`, `t-prod1234`

Tenant IDs are assigned at provisioning time and never change. They appear in access tokens, S3 bucket names, OpenSearch index names, and API responses wherever tenant scoping is required.

---

## What You Get as a Tenant

### Dedicated S3 Buckets

You get two dedicated, private S3 buckets — one for your OpenAPI specifications and one for your log archive. No other tenant has access to these buckets.

| Bucket                 | Purpose                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **OASpec bucket**      | Stores the OpenAPI specifications you upload to Derrops. See [OASpec Bucket](./oaspec-bucket) for details. |
| **Log archive bucket** | Long-term storage for your HTTP request logs captured by the Derrops relay.                                |

Your buckets are yours. Derrops uses them to power enrichment and search features, but they are scoped exclusively to your tenant.

### Private OpenAPI Catalogue

In addition to the [Derrops-managed public catalogue](#derrops-managed-catalogue) of well-known APIs, you get a private search space for OpenAPI specs you upload yourself. When Derrops enriches your API logs, your private specs are always checked first — they take precedence over the public catalogue.

This means you can:

- Add internal APIs that aren't in any public directory
- Override a public spec with a customised version (e.g., a private staging variant)

See [OASpec Bucket](./oaspec-bucket) for how to upload specs to your tenant.

### Isolated Search Space

Every search query you make — whether from the portal or via enrichment — is scoped to your tenant. Results from other tenants are never returned.

---

## Derrops-Managed Catalogue

In addition to your private specs, all tenants have read-only access to the Derrops-managed public catalogue. This catalogue contains thousands of well-known API specifications sourced from [APIs-guru/openapi-directory](https://github.com/APIs-guru/openapi-directory) and curated provider additions (Stripe, AWS, Twilio, and others). It is updated automatically.

You can use the public catalogue without uploading anything. If you upload a spec that overlaps with one in the public catalogue, yours takes precedence.

### The Global Tenant

The public catalogue is stored under a special built-in tenant: **`t-glbl0000`**. This tenant is not a customer — it is a read-only, platform-managed space that holds all publicly available OpenAPI specifications.

Every customer tenant automatically has read access to `t-glbl0000`. You cannot write to it or modify its contents. When Derrops enriches your API logs, it searches your private tenant first, then falls back to `t-glbl0000` if no match is found in your private space.

---

## Access and Sessions

### Authentication

Derrops uses AWS Cognito for authentication. The Cognito User Pool is structured around two concepts:

**Customer groups** — every user in a customer is a member of a Cognito group named after their customer:

```
customer_{customer_id}
```

This group identifies which customer the user belongs to, independent of which tenant they are currently accessing.

**Per-tenant app clients and subdomains** — each tenant has its own dedicated Cognito app client and subdomain. Subdomains follow the convention:

```
{tenantKey}.{customerKey}.app.derrops.com
```

Where `customerKey` is globally unique across all Derrops customers, and `tenantKey` is unique within that customer. When a user authenticates via a tenant's subdomain, Cognito issues a **JWT access token** scoped to that tenant, containing:

```
custom:tenant_id = "t-acme0001"
```

### Subdomains

| URL                                         | Purpose                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `{tenantKey}.{customerKey}.app.derrops.com` | Sign in directly to a specific tenant — the typical flow.                                    |
| `{customerKey}.app.derrops.com`             | Sign in at the customer level to see which tenants you have access to, then navigate to one. |

Most users will know their tenant's subdomain and go there directly. The customer-level subdomain is a convenience for users who are unsure which tenant to access.

Selecting a tenant from the customer portal redirects to that tenant's subdomain, where the user signs in again to establish a tenant-scoped session.

### Session Scoping

Each authenticated session is scoped to exactly **one tenant**. There is no way to switch tenants within a session — to access a different tenant, sign in through that tenant's subdomain. Because all tenants belong to the same customer, the same user credentials work across all of them.

### How Backend Services Enforce Scoping

Every request to the Derrops API must include the Cognito access token. Backend services:

1. Validate the token signature and expiry.
2. Extract the `custom:tenant_id` claim from the token.
3. Use that tenant ID to scope **all** database queries, OpenSearch queries, and S3 operations — no additional tenant parameter is accepted or required from the caller.

This means it is architecturally impossible for an authenticated request to read or write data belonging to a different tenant, regardless of what parameters the caller supplies.

---

## Data Isolation Guarantee

Derrops enforces tenant isolation at multiple independent levels:

| Level              | What it does                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Storage**        | Your S3 buckets and OpenSearch index are dedicated to your tenant. Access policies permit only your tenant's credentials.                                                                                   |
| **Network**        | All traffic flows through a private VPC. Resources are not publicly accessible.                                                                                                                             |
| **Authentication** | Every API request is authenticated and your tenant identity is verified before any data is read or written.                                                                                                 |
| **Query scoping**  | All database and search queries are automatically scoped to your tenant. There is no way to query another tenant's data through the Derrops API.                                                            |
| **AWS tagging**    | All tenant-specific AWS resources are tagged with both `tenantId` and `customerId`, making it straightforward to filter costs, audit access, and manage resources by tenant or customer in the AWS console. |

---

## Multi-Environment Tenants

If you run separate environments (production, staging, development), we recommend provisioning a separate tenant per environment. This gives each environment completely isolated storage, logs, and specs, and makes it safe to test changes in staging without any risk to production data.

---

## Related Pages

- [OASpec Bucket](./oaspec-bucket) — uploading and managing your OpenAPI specifications
- [Getting Started](./getting-started) — connecting your first application to Derrops
- [Plans](./plans) — feature availability and limits by plan tier
