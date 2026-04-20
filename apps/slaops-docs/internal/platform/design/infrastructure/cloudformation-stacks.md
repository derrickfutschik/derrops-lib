---
sidebar_position: 6
title: CloudFormation Stacks
tags:
  - infrastructure
  - iac
  - architecture
---

# CloudFormation Stacks

This is the authoritative registry of every CloudFormation stack in the SLAOps platform. Every stack — whether managed by CDK (`packages/slaops-infra`) or Amplify Gen 2 (`packages/slaops-backend`) — must have an entry here.

**When you add, rename, or remove a CloudFormation stack, update this document in the same commit.**

---

## Deployment model

The platform uses two separate deployment mechanisms:

- **`@slaops/infra` (CDK)** — long-lived infrastructure stacks deployed with `pnpm infra:deploy`. These are stable, change infrequently, and are the source of exports consumed by other stacks.
- **`@slaops/backend` (Amplify Gen 2)** — feature stacks deployed with `pnpm amplify:deploy`. Amplify auto-generates stack names; these stacks import from the CDK stacks via `Fn.importValue`.

### Deployment order

```
slaops--platform--vpc
  └── slaops--platform--security-groups
  └── slaops--platform--dns
  └── slaops--platform--app-database
  └── slaops--platform--opensearch

slaops--auth--cognito          (independent)
slaops--oaspec--source         (independent)

[Amplify: api Lambda stack]    (imports from all of the above)
[Amplify: indexer Lambda stack](imports from opensearch, oaspec--source)

slaops--platform--api-gateway  (imports Lambda ARN from Amplify — deploy last)
```

---

## CDK stacks (`packages/slaops-infra`)

### `slaops--platform--vpc`

| Field                | Value                                    |
| -------------------- | ---------------------------------------- |
| **Logical ID**       | `SlaOpsVpcStack`                         |
| **Class**            | `VpcStack`                               |
| **File**             | `packages/slaops-infra/lib/stack/vpc.ts` |
| **Domain / Service** | `platform` / `vpc`                       |
| **Dependencies**     | none                                     |

**Resources**: VPC, public/private/isolated subnets across 3 AZs, NAT Gateways, Internet Gateway, optional VPC Flow Log.

**Exports**:

- `slaops--platform--vpc--id`
- `slaops--platform--vpc--cidr-block`
- `slaops--platform--vpc--subnet-public-{a,b,c}`
- `slaops--platform--vpc--subnet-private-{a,b,c}`
- `slaops--platform--vpc--subnet-isolated-{a,b,c}`

---

### `slaops--platform--security-groups`

| Field                | Value                                               |
| -------------------- | --------------------------------------------------- |
| **Logical ID**       | `SlaOpsSecurityGroupStack`                          |
| **Class**            | `SecurityGroupStack`                                |
| **File**             | `packages/slaops-infra/lib/stack/security-group.ts` |
| **Domain / Service** | `platform` / `security-groups`                      |
| **Dependencies**     | `slaops--platform--vpc`                             |

**Resources**: Security groups for OpenSearch, Aurora, backend Lambda, and Cloud Lambda.

**Exports**:

- `slaops--platform--opensearch--sg-id`
- `slaops--platform--app-database--sg-id`
- `slaops--platform--backend--sg-id`
- `slaops--platform--cloud--sg-id`

---

### `slaops--platform--dns`

| Field                | Value                                                    |
| -------------------- | -------------------------------------------------------- |
| **Logical ID**       | `SlaOpsHostedZoneStack`                                  |
| **Class**            | `HostedZoneStack`                                        |
| **File**             | `packages/slaops-infra/lib/stack/private-hosted-zone.ts` |
| **Domain / Service** | `platform` / `dns`                                       |
| **Dependencies**     | `slaops--platform--vpc`                                  |

**Resources**: Route 53 private hosted zone associated with the VPC.

**Exports**:

- `slaops--platform--dns--hosted-zone-id`
- `slaops--platform--dns--hosted-zone-name`

---

### `slaops--platform--app-database`

| Field                | Value                                             |
| -------------------- | ------------------------------------------------- |
| **Logical ID**       | `SlaOpsDatabaseStack`                             |
| **Class**            | `AppDatabaseStack`                                |
| **File**             | `packages/slaops-infra/lib/stack/app-database.ts` |
| **Domain / Service** | `platform` / `app-database`                       |
| **Dependencies**     | `slaops--platform--vpc`                           |

**Resources**: Aurora Serverless v2 PostgreSQL cluster (writer + reader), Secrets Manager credentials, EC2 bastion host.

**Exports**:

- `slaops--platform--app-database--cluster-endpoint`
- `slaops--platform--app-database--cluster-read-endpoint`
- `slaops--platform--app-database--name`
- `slaops--platform--app-database--secret-arn`
- `slaops--platform--app-database--port`
- `slaops--platform--app-database--bastion-id`

---

### `slaops--platform--opensearch`

| Field                | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| **Logical ID**       | `SlaOpsOpenSearchStack`                                      |
| **Class**            | `OpenSearchStack`                                            |
| **File**             | `packages/slaops-infra/lib/stack/app-opensearch.ts`          |
| **Domain / Service** | `platform` / `opensearch`                                    |
| **Dependencies**     | `slaops--platform--vpc`, `slaops--platform--security-groups` |

**Resources**: OpenSearch Serverless collection (`slaops--opensearch`), VPC endpoint, network security policy, data access policy.

**Exports**:

- `slaops--platform--opensearch--collection-id`
- `slaops--platform--opensearch--collection-name`
- `slaops--platform--opensearch--collection-arn`
- `slaops--platform--opensearch--collection-endpoint`
- `slaops--platform--opensearch--dashboard-endpoint`
- `slaops--platform--opensearch--vpc-endpoint-id`

---

### `slaops--auth--cognito`

| Field                | Value                                         |
| -------------------- | --------------------------------------------- |
| **Logical ID**       | `SlaOpsAuthStack`                             |
| **Class**            | `AuthStack`                                   |
| **File**             | `packages/slaops-infra/lib/stack/userpool.ts` |
| **Domain / Service** | `auth` / `cognito`                            |
| **Dependencies**     | none                                          |

**Resources**: Cognito User Pool, User Pool Client, Identity Pool, pre-token-generation Lambda, SQS publish IAM role, identity pool authenticated IAM role.

**Exports**:

- `slaops--auth--cognito--user-pool-id`
- `slaops--auth--cognito--user-pool-arn`
- `slaops--auth--cognito--user-pool-client-id`
- `slaops--auth--cognito--user-pool-provider-name`
- `slaops--auth--cognito--user-pool-provider-url`
- `slaops--auth--cognito--identity-pool-id`
- `slaops--auth--cognito--identity-pool-auth-role-arn`
- `slaops--auth--cognito--sqs-publish-role-arn`

---

### `slaops--oaspec--source`

| Field                | Value                                                   |
| -------------------- | ------------------------------------------------------- |
| **Logical ID**       | `SlaOpsOpenApiBucketStack`                              |
| **Class**            | `OpenApiBucketStack`                                    |
| **File**             | `packages/slaops-infra/lib/stack/app-openapi-bucket.ts` |
| **Domain / Service** | `oaspec` / `source`                                     |
| **Dependencies**     | none                                                    |
| **Extra tag**        | `slaops:tenant-id: slaops`                              |

**Resources**: S3 bucket for SLAOps-managed OpenAPI specifications (`{region}--{env}--slaops--slaops--oaspec--source--specs`). This is the platform's own OASpec catalogue sourced from APIs-guru and other curated collections.

**Exports**:

- `slaops--oaspec--source--bucket-arn`
- `slaops--oaspec--source--bucket-name`

---

### `slaops--platform--api-gateway`

| Field                | Value                                                               |
| -------------------- | ------------------------------------------------------------------- |
| **Logical ID**       | `SlaOpsApiStack`                                                    |
| **Class**            | `ApiStack`                                                          |
| **File**             | `packages/slaops-infra/lib/stack/apigateway.ts`                     |
| **Domain / Service** | `platform` / `api-gateway`                                          |
| **Dependencies**     | Amplify API Lambda stack (Lambda ARN passed via env or CDK context) |

**Deploy condition**: Only deployed when `LAMBDA_FUNCTION_ARN` env var or `lambdaFunctionArn` CDK context value is provided. Deploy the Amplify backend first.

**Resources**: API Gateway REST API proxying to the NestJS API Lambda, CloudWatch access logging, usage plan with rate limiting (50 req/s, 100 burst).

**Exports**:

- `slaops--platform--api-gateway--url`
- `slaops--platform--api-gateway--id`
- `slaops--platform--api-gateway--arn`
- `slaops--platform--api-gateway--endpoint`

---

## Amplify stacks (`packages/slaops-backend`)

Amplify Gen 2 auto-generates CloudFormation stack names at deploy time. The logical resource IDs and the exports they produce are documented below. Imports consumed from CDK stacks are also listed.

### API Lambda stack

**Amplify resource**: `backend.api` (function: `amplify/functions/api/`)

**Imports from CDK**:

- `slaops--platform--app-database--cluster-endpoint`
- `slaops--platform--app-database--secret-arn`
- `slaops--auth--cognito--user-pool-id`
- `slaops--platform--vpc--id`
- `slaops--platform--cloud--sg-id`
- `slaops--platform--vpc--subnet-private-{a,b,c}`
- `slaops--platform--opensearch--collection-endpoint`
- `slaops--platform--opensearch--collection-arn`

**Exports**:

- `slaops--platform--api--lambda-arn`
- `slaops--platform--api--lambda-name`

---

### OpenAPI Indexer Lambda stack

**Amplify resource**: `backend.openapiIndexer` (function: `amplify/functions/openapi-indexer/`)

**Imports from CDK**:

- `slaops--platform--opensearch--collection-endpoint`
- `slaops--platform--opensearch--collection-arn`
- `slaops--oaspec--source--bucket-arn`
- `slaops--oaspec--source--bucket-name`
- `slaops--platform--cloud--sg-id`
- `slaops--platform--vpc--subnet-private-{a,b,c}`

**Exports**:

- `slaops--oaspec--indexer--lambda-arn`
- `slaops--oaspec--storage--bucket-name`
- `slaops--oaspec--staging--bucket-name`

**Resources**: OASpec storage bucket (versioned, retained on destroy), OASpec staging bucket (ephemeral, auto-delete on destroy). S3 event notifications trigger the indexer on object create/remove under the `APIs/` prefix.

---

## Related documents

- [Platform Domains](./platform-domains) — domain registry and CDK tag values
- [Tagging Conventions](./tagging-conventions) — required tags and CDK enforcement
- [CDK Naming & Tagging Audit](./cdk-naming-tagging-audit) — verified current names and exports
- [Multi-Tenancy](./multi-tenancy) — per-tenant stacks (future)
