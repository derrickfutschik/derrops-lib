---
title: OASpecBucket
slug: oaspec-bucket
description: Information about the OASpecBucket
---

# OpenAPI Specification Bucket(s)

Spec Buckets follow the [Derrops S3 naming convention](/blog/derrops-naming-sheet): globally unique buckets include `{region}` and `{env}`; shared/platform resources omit `{tenant}`; silo tenant buckets place `{tenant}` between `{org}` and `{domain}`.

- `us-east-1--prod--derrops--oaspec--storage--global`

| Tenancy          | Bucket Name                                                           | Example                                                       | Description                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global           | `${region}--${env}--${org}--${domain}--${service}--${key}`            | `us-east-1--prod--derrops--t-glbl0000--oaspec--storage--specs` | Global library of OpenAPI Specifications. Maintained by Derrops, however customers can add their own specifications to the global repository if they wish. |
| Dedicated Tenant | `${region}--${env}--${org}--${tenant}--${domain}--${service}--${key}` | `us-east-1--prod--derrops--t-1a2b3c4d--oaspec--storage--specs` | Dedicated S3 Bucket for a single tenant. Every tenant gets their own bucket — specs are never co-mingled across tenants.                                  |

Every tenant's OASpec bucket is provisioned automatically when the tenant is onboarded. You do not need to create it manually. For more on tenant isolation and the other dedicated resources you receive, see [Multi-Tenancy](./multi-tenancy).

When you upload a spec to your tenant bucket, Derrops automatically indexes it into your private OpenSearch catalogue. Your private specs always take precedence over the Derrops-managed public catalogue when enriching your API logs.
