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
> **Scope**: All stacks in `packages/derrops-infra/lib/stack/` and `packages/derrops-backend/amplify/backend.ts`
> **Standards applied**: [Tagging Conventions](./tagging-conventions) · [Platform Domains](./platform-domains) · [Derrops Naming Conventions](/blog/derrops-conventions) · [AWS Resource Naming Cheatsheet](/blog/derrops-naming-sheet)

All stacks pass naming and tagging conventions. This document serves as the verified reference for current resource names, export names, and applied tags.

---

## Tags

Common tags are applied via `cdk.Tags.of(app)` in `bin/cdk.ts`. Domain and service tags are applied via `Tags.of(this)` in each stack constructor.

| Tag key             | Set in                    | Value                            |
| ------------------- | ------------------------- | -------------------------------- |
| `derrops:org`        | `bin/cdk.ts`              | `derrops`                         |
| `derrops:env`        | `bin/cdk.ts`              | `$ENVIRONMENT` (default: `prod`) |
| `derrops:managed-by` | `bin/cdk.ts`              | `cdk`                            |
| `derrops:domain`     | each stack constructor    | see per-stack table below        |
| `derrops:service`    | each stack constructor    | see per-stack table below        |
| `derrops:tenant-id`  | `OpenApiBucketStack` only | `derrops`                         |

### Per-stack domain and service tags

| Stack class          | `derrops:domain` | `derrops:service`  |
| -------------------- | --------------- | ----------------- |
| `VpcStack`           | `platform`      | `vpc`             |
| `SecurityGroupStack` | `platform`      | `security-groups` |
| `HostedZoneStack`    | `platform`      | `dns`             |
| `AppDatabaseStack`   | `platform`      | `app-database`    |
| `OpenSearchStack`    | `platform`      | `opensearch`      |
| `OpenApiBucketStack` | `oaspec`        | `source`          |
| `AuthStack`          | `auth`          | `cognito`         |
| `ApiStack`           | `platform`      | `api-gateway`     |

:::note CfnCollection tag caveat
`CfnCollection` (OpenSearch Serverless) does not inherit CDK stack-level tags. Tags are applied directly via `this.collection.tags.setTag()` inside `OpenSearchStack`. See [Tagging Conventions — Tag propagation caveat](./tagging-conventions#tag-propagation-caveat).
:::

---

## Stack names

Stack names follow `derrops--{domain}--{service}` — no `--stack` suffix.

| Logical ID                 | Stack name                          |
| -------------------------- | ----------------------------------- |
| `DerropsVpcStack`           | `derrops--platform--vpc`             |
| `DerropsAuthStack`          | `derrops--auth--cognito`             |
| `DerropsDatabaseStack`      | `derrops--platform--app-database`    |
| `DerropsSecurityGroupStack` | `derrops--platform--security-groups` |
| `DerropsHostedZoneStack`    | `derrops--platform--dns`             |
| `DerropsOpenSearchStack`    | `derrops--platform--opensearch`      |
| `DerropsOpenApiBucketStack` | `derrops--oaspec--source`            |
| `DerropsApiStack`           | `derrops--platform--api-gateway`     |

---

## Physical resource names

| Stack                | Resource type                   | Physical name                                              |
| -------------------- | ------------------------------- | ---------------------------------------------------------- |
| `AuthStack`          | Lambda function                 | `derrops--auth--cognito--pre-token-generation`              |
| `AuthStack`          | Cognito User Pool               | `derrops--auth--cognito--users`                             |
| `AuthStack`          | Cognito Identity Pool           | `derrops--auth--cognito--relay-identity-pool`               |
| `AuthStack`          | IAM Role                        | `derrops--platform--auth--sqs-publish-role`                 |
| `AuthStack`          | IAM Role                        | `derrops--platform--auth--identity-pool-auth-role`          |
| `SecurityGroupStack` | Security Group                  | `derrops--platform--opensearch--sg`                         |
| `SecurityGroupStack` | Security Group                  | `derrops--platform--app-database--sg`                       |
| `SecurityGroupStack` | Security Group                  | `derrops--platform--backend--sg`                            |
| `SecurityGroupStack` | Security Group                  | `derrops--platform--cloud--sg`                              |
| `AppDatabaseStack`   | Secrets Manager                 | `derrops/platform/app-database/credentials` ¹               |
| `AppDatabaseStack`   | EC2 Bastion                     | `derrops--platform--app-database--bastion`                  |
| `OpenApiBucketStack` | S3 Bucket                       | `{region}--{env}--derrops--derrops--oaspec--source--specs` ² |
| `OpenSearchStack`    | CfnCollection                   | `derrops--opensearch` ³                                     |
| `OpenSearchStack`    | CfnVpcEndpoint                  | `derrops--opensearch--vpc-ep` ³                             |
| `OpenSearchStack`    | CfnSecurityPolicy (network)     | `derrops--opensearch--net-policy` ³                         |
| `OpenSearchStack`    | CfnSecurityPolicy (data access) | `derrops--opensearch--data-access` ³                        |
| `ApiStack`           | API Gateway REST API            | `derrops--platform--api-gateway`                            |
| `VpcStack`           | VPC Flow Log                    | `derrops--platform--vpc--flow-log`                          |

¹ Secrets Manager uses `/` as the path delimiter. Segments still follow `{org}/{domain}/{service}/{key}`.

² S3 bucket names are globally unique — prefixed with `{region}--{env}`. The second `derrops` segment is the tenant ID (reserved platform tenant).

³ OpenSearch Serverless resource names are capped at 32 characters. Shortened forms are used; the full `derrops--platform--opensearch--*` pattern is only applied to CloudFormation exports.

---

## CloudFormation export names

All exports follow `derrops--{domain}--{service}--{key}`.

### `packages/derrops-infra` exports

| Stack                | Export name                                             |
| -------------------- | ------------------------------------------------------- |
| `VpcStack`           | `derrops--platform--vpc--id`                             |
| `VpcStack`           | `derrops--platform--vpc--cidr-block`                     |
| `VpcStack`           | `derrops--platform--vpc--subnet-public-{a,b,c}`          |
| `VpcStack`           | `derrops--platform--vpc--subnet-private-{a,b,c}`         |
| `VpcStack`           | `derrops--platform--vpc--subnet-isolated-{a,b,c}`        |
| `SecurityGroupStack` | `derrops--platform--opensearch--sg-id`                   |
| `SecurityGroupStack` | `derrops--platform--app-database--sg-id`                 |
| `SecurityGroupStack` | `derrops--platform--backend--sg-id`                      |
| `SecurityGroupStack` | `derrops--platform--cloud--sg-id`                        |
| `HostedZoneStack`    | `derrops--platform--dns--hosted-zone-id`                 |
| `HostedZoneStack`    | `derrops--platform--dns--hosted-zone-name`               |
| `AppDatabaseStack`   | `derrops--platform--app-database--cluster-endpoint`      |
| `AppDatabaseStack`   | `derrops--platform--app-database--cluster-read-endpoint` |
| `AppDatabaseStack`   | `derrops--platform--app-database--name`                  |
| `AppDatabaseStack`   | `derrops--platform--app-database--secret-arn`            |
| `AppDatabaseStack`   | `derrops--platform--app-database--port`                  |
| `AppDatabaseStack`   | `derrops--platform--app-database--bastion-id`            |
| `OpenSearchStack`    | `derrops--platform--opensearch--collection-id`           |
| `OpenSearchStack`    | `derrops--platform--opensearch--collection-name`         |
| `OpenSearchStack`    | `derrops--platform--opensearch--collection-arn`          |
| `OpenSearchStack`    | `derrops--platform--opensearch--collection-endpoint`     |
| `OpenSearchStack`    | `derrops--platform--opensearch--dashboard-endpoint`      |
| `OpenSearchStack`    | `derrops--platform--opensearch--vpc-endpoint-id`         |
| `OpenApiBucketStack` | `derrops--oaspec--source--bucket-arn`                    |
| `OpenApiBucketStack` | `derrops--oaspec--source--bucket-name`                   |
| `AuthStack`          | `derrops--auth--cognito--user-pool-id`                   |
| `AuthStack`          | `derrops--auth--cognito--user-pool-arn`                  |
| `AuthStack`          | `derrops--auth--cognito--user-pool-client-id`            |
| `AuthStack`          | `derrops--auth--cognito--user-pool-provider-name`        |
| `AuthStack`          | `derrops--auth--cognito--user-pool-provider-url`         |
| `AuthStack`          | `derrops--auth--cognito--identity-pool-id`               |
| `AuthStack`          | `derrops--auth--cognito--identity-pool-auth-role-arn`    |
| `AuthStack`          | `derrops--auth--cognito--sqs-publish-role-arn`           |
| `ApiStack`           | `derrops--platform--api-gateway--url`                    |
| `ApiStack`           | `derrops--platform--api-gateway--id`                     |
| `ApiStack`           | `derrops--platform--api-gateway--arn`                    |
| `ApiStack`           | `derrops--platform--api-gateway--endpoint`               |

### `packages/derrops-backend` exports

| Stack                        | Export name                            |
| ---------------------------- | -------------------------------------- |
| Amplify API Lambda stack     | `derrops--platform--api--lambda-arn`    |
| Amplify API Lambda stack     | `derrops--platform--api--lambda-name`   |
| Amplify Indexer Lambda stack | `derrops--oaspec--indexer--lambda-arn`  |
| Amplify Indexer Lambda stack | `derrops--oaspec--storage--bucket-name` |
| Amplify Indexer Lambda stack | `derrops--oaspec--staging--bucket-name` |

---

## Related Documents

- [Platform Domains](./platform-domains) — domain registry with CDK tag values and service ownership
- [Tagging Conventions](./tagging-conventions) — required tag specification and CDK enforcement patterns
- [Multi-Tenancy](./multi-tenancy) — per-tenant tagging (`derrops:tenant-id`)
- [Derrops Naming Conventions](/blog/derrops-conventions) — naming principles
- [AWS Resource Naming Cheatsheet](/blog/derrops-naming-sheet) — per-service naming reference
