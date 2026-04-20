---
sidebar_position: 1
title: Tagging Conventions
tags:
  - infrastructure
  - tagging
  - iac
  - cost-allocation
  - architecture
---

# Tagging Conventions

Every AWS resource provisioned by SLAOps must carry a standard set of tags. Tags are the mechanism for cost allocation, access-boundary enforcement, security auditing, and incident scoping. **Tags are applied by IaC (CDK) — never set manually.**

For the naming and segregation principles that inform these tags, see the [Derrops Guide to Naming Conventions and Segregation](/blog/derrops-conventions) and the [AWS Resource Naming Cheatsheet](/blog/derrops-naming-sheet).

---

## Required Tags

Every SLAOps resource — shared platform infrastructure and per-tenant resources alike — must carry these tags:

| Tag key             | Value format                 | Example                         | Purpose                                                                                |
| ------------------- | ---------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| `slaops:org`        | Literal `slaops`             | `slaops`                        | Top-level ownership boundary; enables org-wide queries in Security Hub, Cost Explorer  |
| `slaops:env`        | `prod` \| `dev` \| `staging` | `prod`                          | Deployment stage; used in billing dashboards and runbook targeting                     |
| `slaops:domain`     | Kebab-case bounded domain    | `platform`, `oaspec`, `logging` | Business capability boundary; aligns with the `{domain}` segment in naming conventions |
| `slaops:service`    | Kebab-case service name      | `api`, `indexer`, `sync-lambda` | Deployable unit identity; enables per-service cost and security grouping               |
| `slaops:managed-by` | Literal `cdk`                | `cdk`                           | Signals the resource is IaC-managed; manual changes are a drift signal                 |

## Tenant Tag (per-tenant resources only)

Resources that belong to a specific tenant carry one additional tag:

| Tag key            | Value format     | Example    | Purpose                                                                       |
| ------------------ | ---------------- | ---------- | ----------------------------------------------------------------------------- |
| `slaops:tenant-id` | Opaque tenant ID | `t-a3f8b2` | Tenant attribution for cost allocation, IAM condition keys, and audit queries |

Shared platform resources (VPC, Aurora cluster, API Gateway, OpenSearch collection) do **not** carry `slaops:tenant-id` — they belong to no single tenant.

:::note
`slaops:tenant-id` uses the opaque ID, never a human-readable name. See [Multi-Tenancy — Tenant ID format](./multi-tenancy#tenant-id-format) for why. The reserved ID `slaops` is used for platform-owned resources such as the managed OASpec index.
:::

## Optional Tags

| Tag key                      | Value format                             | When to add                                                                                               |
| ---------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `slaops:component`           | Kebab-case component label               | When a service has multiple independently-operable sub-components (e.g., `opensearch-index`, `s3-prefix`) |
| `slaops:cost-centre`         | Cost centre code                         | When finance requires per-tenant or per-domain billing attribution                                        |
| `slaops:data-classification` | `public` \| `internal` \| `confidential` | On storage resources (S3, RDS, DynamoDB, OpenSearch) that hold customer data                              |

---

## Complete Tag Set — Examples

### Shared platform resource (Aurora cluster)

```
slaops:org          = slaops
slaops:env          = prod
slaops:domain       = platform
slaops:service      = app-database
slaops:managed-by   = cdk
```

### Per-tenant OpenSearch index

```
slaops:org          = slaops
slaops:env          = prod
slaops:domain       = oaspec
slaops:service      = indexer
slaops:managed-by   = cdk
slaops:tenant-id    = t-a3f8b2
```

### SLAOps-managed OASpec index (reserved `slaops` tenant)

```
slaops:org          = slaops
slaops:env          = prod
slaops:domain       = oaspec
slaops:service      = indexer
slaops:managed-by   = cdk
slaops:tenant-id    = slaops
```

### Tenant IAM role

```
slaops:org          = slaops
slaops:env          = prod
slaops:domain       = platform
slaops:service      = api
slaops:managed-by   = cdk
slaops:tenant-id    = t-a3f8b2
```

### Tenant OASpec S3 bucket

```
slaops:org          = slaops
slaops:env          = prod
slaops:domain       = oaspec
slaops:service      = storage
slaops:managed-by   = cdk
slaops:tenant-id    = t-a3f8b2
```

Bucket name: `us-east-1--prod--slaops--t-a3f8b2--oaspec--storage--specs`

### Tenant logs S3 bucket

```
slaops:org          = slaops
slaops:env          = prod
slaops:domain       = logging
slaops:service      = storage
slaops:managed-by   = cdk
slaops:tenant-id    = t-a3f8b2
```

Bucket name: `us-east-1--prod--slaops--t-a3f8b2--logging--storage--logs`

---

## IaC Enforcement (CDK)

Tags are applied in CDK using `Tags.of()` at the construct or stack level. Applying tags at the stack level propagates them to all child resources automatically — this is the preferred approach to guarantee no resource is missed.

### Stack-level tags (shared infrastructure)

```typescript
import { Tags } from 'aws-cdk-lib'

// In the stack constructor or bin/cdk.ts after stack instantiation:
Tags.of(appDatabaseStack).add('slaops:org', 'slaops')
Tags.of(appDatabaseStack).add('slaops:env', props.env)
Tags.of(appDatabaseStack).add('slaops:domain', 'platform')
Tags.of(appDatabaseStack).add('slaops:service', 'app-database')
Tags.of(appDatabaseStack).add('slaops:managed-by', 'cdk')
```

### Tenant construct tags

The `TenantConstruct` applies `slaops:tenant-id` to all its child resources in addition to the base tags:

```typescript
import { Tags } from 'aws-cdk-lib'

export class TenantConstruct extends Construct {
  constructor(scope: Construct, id: string, props: TenantConstructProps) {
    super(scope, id)

    // Base tags — inherited by all child resources
    Tags.of(this).add('slaops:org', 'slaops')
    Tags.of(this).add('slaops:env', props.env)
    Tags.of(this).add('slaops:domain', 'platform')
    Tags.of(this).add('slaops:service', 'tenant-provisioner')
    Tags.of(this).add('slaops:managed-by', 'cdk')
    Tags.of(this).add('slaops:tenant-id', props.tenantId)

    // ... provision OpenSearch index, S3 prefix, IAM role, etc.
  }
}
```

:::tip
Apply `Tags.of()` at the highest scope that makes sense. Stack-level tags cover all resources in the stack. Use construct-level tags when only a sub-tree of resources needs a different value (e.g., `slaops:tenant-id`).
:::

### Tag propagation caveat

Some AWS resources do not inherit tags from their parent CloudFormation stack:

- **OpenSearch Serverless collections** — tags must be set directly on the `CfnCollection` resource
- **S3 object prefixes** — S3 objects inherit bucket tags only if configured explicitly; set object-level tags via the upload handler if per-object attribution is required
- **IAM resources** — inherit stack tags normally

Always verify tag propagation with `aws resourcegroupstaggingapi get-resources` after deployment.

---

## Enforcing Tags in CI/CD

### AWS Config rule

The `slaops--platform--compliance--required-tags-rule` AWS Config rule (deployed in `slaops-infra`) flags any resource missing the five required tags. Violations appear in Security Hub and trigger a Slack alert to the platform team.

### CDK aspects

A CDK Aspect (`RequiredTagsAspect`) in `packages/slaops-infra/lib/aspects/` validates required tags at synth time and throws a `Annotations.of(node).addError()` if any construct in the app is missing a required tag. This catches omissions before deployment.

```typescript
// bin/cdk.ts — applied to the entire CDK app
Aspects.of(app).add(
  new RequiredTagsAspect({
    required: ['slaops:org', 'slaops:env', 'slaops:domain', 'slaops:service', 'slaops:managed-by'],
  }),
)
```

---

## Cost Allocation

AWS Cost Explorer is configured to split costs by:

1. `slaops:env` — environment-level billing (prod vs dev)
2. `slaops:domain` — domain-level spend tracking
3. `slaops:tenant-id` — per-tenant cost attribution (enables per-tenant billing)

All five required tags are activated as Cost Allocation Tags in the AWS billing console. New tags must be activated there before they appear in Cost Explorer reports.

---

## Security and Audit Use Cases

Tags enable IAM condition keys and audit queries without embedding resource names in policies:

```json
{
  "Condition": {
    "StringEquals": {
      "aws:ResourceTag/slaops:tenant-id": "${aws:PrincipalTag/slaops:tenant-id}"
    }
  }
}
```

This condition ensures a principal can only access resources tagged with the same `tenant-id` as the principal itself — enforcing tenant isolation at the IAM policy level without per-tenant policy documents.

Security Hub and GuardDuty findings are filtered and grouped by `slaops:service` and `slaops:tenant-id` to scope incidents to the affected service and tenant without cross-tenant noise.

---

## Summary Reference

| Tag                          | Required on shared resources | Required on tenant resources | Example value      |
| ---------------------------- | ---------------------------- | ---------------------------- | ------------------ |
| `slaops:org`                 | ✅                           | ✅                           | `slaops`           |
| `slaops:env`                 | ✅                           | ✅                           | `prod`             |
| `slaops:domain`              | ✅                           | ✅                           | `oaspec`           |
| `slaops:service`             | ✅                           | ✅                           | `indexer`          |
| `slaops:managed-by`          | ✅                           | ✅                           | `cdk`              |
| `slaops:tenant-id`           | ❌                           | ✅                           | `t-a3f8b2`         |
| `slaops:component`           | Optional                     | Optional                     | `opensearch-index` |
| `slaops:data-classification` | Optional                     | Optional                     | `confidential`     |

---

## Further Reading

- [Derrops Guide to Naming Conventions](/blog/derrops-conventions) — segregation strategy, segment stability, and the rationale behind consistent naming
- [AWS Resource Naming Cheatsheet](/blog/derrops-naming-sheet) — per-service naming patterns that complement these tags
- [Multi-Tenancy (Design)](./multi-tenancy) — IaC provisioning, TenantConstruct, access control, and the full per-tenant resource catalogue
