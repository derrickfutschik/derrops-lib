---
sidebar_position: 3
title: CDK Naming & Tagging Audit
tags:
  - infrastructure
  - iac
  - tagging
  - architecture
---

# CDK Naming & Tagging Audit

> **Last verified**: 2026-03-30
> **Scope**: All stacks in `packages/slaops-infra/lib/stack/` and `packages/slaops-backend/amplify/backend.ts`
> **Standards applied**: [Tagging Conventions](./tagging-conventions) · [Platform Domains](./platform-domains) · [Derrops Naming Conventions](/blog/derrops-conventions) · [AWS Resource Naming Cheatsheet](/blog/derrops-naming-sheet)

All stacks pass naming and tagging conventions. This document serves as the verified reference for current resource names, export names, and applied tags.

---

## Tags

Common tags are applied via `cdk.Tags.of(app)` in `bin/cdk.ts`. Domain and service tags are applied via `Tags.of(this)` in each stack constructor.

| Tag key | Set in | Value |
|---|---|---|
| `slaops:org` | `bin/cdk.ts` | `slaops` |
| `slaops:env` | `bin/cdk.ts` | `$ENVIRONMENT` (default: `prod`) |
| `slaops:managed-by` | `bin/cdk.ts` | `cdk` |
| `slaops:domain` | each stack constructor | see per-stack table below |
| `slaops:service` | each stack constructor | see per-stack table below |
| `slaops:tenant-id` | `OpenApiBucketStack` only | `slaops` |

### Per-stack domain and service tags

| Stack class | `slaops:domain` | `slaops:service` |
|---|---|---|
| `VpcStack` | `platform` | `vpc` |
| `SecurityGroupStack` | `platform` | `security-groups` |
| `HostedZoneStack` | `platform` | `dns` |
| `AppDatabaseStack` | `platform` | `app-database` |
| `OpenSearchStack` | `platform` | `opensearch` |
| `OpenApiBucketStack` | `oaspec` | `source` |
| `AuthStack` | `auth` | `cognito` |
| `ApiStack` | `platform` | `api-gateway` |

:::note CfnCollection tag caveat
`CfnCollection` (OpenSearch Serverless) does not inherit CDK stack-level tags. Tags are applied directly via `this.collection.tags.setTag()` inside `OpenSearchStack`. See [Tagging Conventions — Tag propagation caveat](./tagging-conventions#tag-propagation-caveat).
:::

---

## Stack names

Stack names follow `slaops--{domain}--{service}` — no `--stack` suffix.

| Logical ID | Stack name |
|---|---|
| `SlaOpsVpcStack` | `slaops--platform--vpc` |
| `SlaOpsAuthStack` | `slaops--auth--cognito` |
| `SlaOpsDatabaseStack` | `slaops--platform--app-database` |
| `SlaOpsSecurityGroupStack` | `slaops--platform--security-groups` |
| `SlaOpsHostedZoneStack` | `slaops--platform--dns` |
| `SlaOpsOpenSearchStack` | `slaops--platform--opensearch` |
| `SlaOpsOpenApiBucketStack` | `slaops--oaspec--source` |
| `SlaOpsApiStack` | `slaops--platform--api-gateway` |

---

## Physical resource names

| Stack | Resource type | Physical name |
|---|---|---|
| `AuthStack` | Lambda function | `slaops--auth--cognito--pre-token-generation` |
| `AuthStack` | Cognito User Pool | `slaops--auth--cognito--users` |
| `AuthStack` | Cognito Identity Pool | `slaops--auth--cognito--relay-identity-pool` |
| `AuthStack` | IAM Role | `slaops--platform--auth--sqs-publish-role` |
| `AuthStack` | IAM Role | `slaops--platform--auth--identity-pool-auth-role` |
| `SecurityGroupStack` | Security Group | `slaops--platform--opensearch--sg` |
| `SecurityGroupStack` | Security Group | `slaops--platform--app-database--sg` |
| `SecurityGroupStack` | Security Group | `slaops--platform--backend--sg` |
| `SecurityGroupStack` | Security Group | `slaops--platform--cloud--sg` |
| `AppDatabaseStack` | Secrets Manager | `slaops/platform/app-database/credentials` ¹ |
| `AppDatabaseStack` | EC2 Bastion | `slaops--platform--app-database--bastion` |
| `OpenApiBucketStack` | S3 Bucket | `{region}--{env}--slaops--slaops--oaspec--source--specs` ² |
| `OpenSearchStack` | CfnCollection | `slaops--opensearch` ³ |
| `OpenSearchStack` | CfnVpcEndpoint | `slaops--opensearch--vpc-ep` ³ |
| `OpenSearchStack` | CfnSecurityPolicy (network) | `slaops--opensearch--net-policy` ³ |
| `OpenSearchStack` | CfnSecurityPolicy (data access) | `slaops--opensearch--data-access` ³ |
| `ApiStack` | API Gateway REST API | `slaops--platform--api-gateway` |
| `VpcStack` | VPC Flow Log | `slaops--platform--vpc--flow-log` |

¹ Secrets Manager uses `/` as the path delimiter. Segments still follow `{org}/{domain}/{service}/{key}`.

² S3 bucket names are globally unique — prefixed with `{region}--{env}`. The second `slaops` segment is the tenant ID (reserved platform tenant).

³ OpenSearch Serverless resource names are capped at 32 characters. Shortened forms are used; the full `slaops--platform--opensearch--*` pattern is only applied to CloudFormation exports.

---

## CloudFormation export names

All exports follow `slaops--{domain}--{service}--{key}`.

### `packages/slaops-infra` exports

| Stack | Export name |
|---|---|
| `VpcStack` | `slaops--platform--vpc--id` |
| `VpcStack` | `slaops--platform--vpc--cidr-block` |
| `VpcStack` | `slaops--platform--vpc--subnet-public-{a,b,c}` |
| `VpcStack` | `slaops--platform--vpc--subnet-private-{a,b,c}` |
| `VpcStack` | `slaops--platform--vpc--subnet-isolated-{a,b,c}` |
| `SecurityGroupStack` | `slaops--platform--opensearch--sg-id` |
| `SecurityGroupStack` | `slaops--platform--app-database--sg-id` |
| `SecurityGroupStack` | `slaops--platform--backend--sg-id` |
| `SecurityGroupStack` | `slaops--platform--cloud--sg-id` |
| `HostedZoneStack` | `slaops--platform--dns--hosted-zone-id` |
| `HostedZoneStack` | `slaops--platform--dns--hosted-zone-name` |
| `AppDatabaseStack` | `slaops--platform--app-database--cluster-endpoint` |
| `AppDatabaseStack` | `slaops--platform--app-database--cluster-read-endpoint` |
| `AppDatabaseStack` | `slaops--platform--app-database--name` |
| `AppDatabaseStack` | `slaops--platform--app-database--secret-arn` |
| `AppDatabaseStack` | `slaops--platform--app-database--port` |
| `AppDatabaseStack` | `slaops--platform--app-database--bastion-id` |
| `OpenSearchStack` | `slaops--platform--opensearch--collection-id` |
| `OpenSearchStack` | `slaops--platform--opensearch--collection-name` |
| `OpenSearchStack` | `slaops--platform--opensearch--collection-arn` |
| `OpenSearchStack` | `slaops--platform--opensearch--collection-endpoint` |
| `OpenSearchStack` | `slaops--platform--opensearch--dashboard-endpoint` |
| `OpenSearchStack` | `slaops--platform--opensearch--vpc-endpoint-id` |
| `OpenApiBucketStack` | `slaops--oaspec--source--bucket-arn` |
| `OpenApiBucketStack` | `slaops--oaspec--source--bucket-name` |
| `AuthStack` | `slaops--auth--cognito--user-pool-id` |
| `AuthStack` | `slaops--auth--cognito--user-pool-arn` |
| `AuthStack` | `slaops--auth--cognito--user-pool-client-id` |
| `AuthStack` | `slaops--auth--cognito--user-pool-provider-name` |
| `AuthStack` | `slaops--auth--cognito--user-pool-provider-url` |
| `AuthStack` | `slaops--auth--cognito--identity-pool-id` |
| `AuthStack` | `slaops--auth--cognito--identity-pool-auth-role-arn` |
| `AuthStack` | `slaops--auth--cognito--sqs-publish-role-arn` |
| `ApiStack` | `slaops--platform--api-gateway--url` |
| `ApiStack` | `slaops--platform--api-gateway--id` |
| `ApiStack` | `slaops--platform--api-gateway--arn` |
| `ApiStack` | `slaops--platform--api-gateway--endpoint` |

### `packages/slaops-backend` exports

| Stack | Export name |
|---|---|
| Amplify API Lambda stack | `slaops--platform--api--lambda-arn` |
| Amplify API Lambda stack | `slaops--platform--api--lambda-name` |
| Amplify Indexer Lambda stack | `slaops--oaspec--indexer--lambda-arn` |
| Amplify Indexer Lambda stack | `slaops--oaspec--storage--bucket-name` |
| Amplify Indexer Lambda stack | `slaops--oaspec--staging--bucket-name` |

---

## Related Documents

- [Platform Domains](./platform-domains) — domain registry with CDK tag values and service ownership
- [Tagging Conventions](./tagging-conventions) — required tag specification and CDK enforcement patterns
- [Multi-Tenancy](./multi-tenancy) — per-tenant tagging (`slaops:tenant-id`)
- [Derrops Naming Conventions](/blog/derrops-conventions) — naming principles
- [AWS Resource Naming Cheatsheet](/blog/derrops-naming-sheet) — per-service naming reference
