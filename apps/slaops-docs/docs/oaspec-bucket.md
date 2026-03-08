---
title: OASpecBucket
slug: oaspec-bucket
description: Information about the OASpecBucket
---

# OpenAPI Specification Bucket(s)

Spec Buckets follow the [Derrops S3 naming convention](/blog/derrops-naming-sheet): globally unique buckets include `{region}` and `{env}`; shared/platform resources omit `{tenant}`; silo tenant buckets place `{tenant}` between `{org}` and `{domain}`.

- `us-east-1--prod--slaops--oaspec--storage--global`

| Tenancy          | Bucket Name                                                           | Example                                                       | Description                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global           | `${region}--${env}--${org}--${domain}--${service}--${key}`            | `us-east-1--prod--slaops--t-glbl0000--oaspec--storage--specs` | Global library of OpenAPI Specifications. Maintained by SLAOps, however customers can add their own specifications to the global repository if they wish. |
| Dedicated Tenant | `${region}--${env}--${org}--${tenant}--${domain}--${service}--${key}` | `us-east-1--prod--slaops--t-1a2b3c4d--oaspec--storage--specs` | Dedicated S3 Bucket for a single tenant.                                                                                                                  |

- `us-east-1--prod--slaops--t-glbl0000--oaspec--storage--specs`
- `us-east-1--prod--slaops--t-1a2b3c4d--oaspec--storage--specs`
