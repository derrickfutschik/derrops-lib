---
sidebar_position: 6
title: CloudFormation Stacks
tags:
  - infrastructure
  - iac
  - architecture
---

# CloudFormation Stacks

This is the authoritative registry of every CloudFormation stack in the Derrops platform. Every stack — whether managed by CDK (`packages/derrops-infra`) or Amplify Gen 2 (`packages/derrops-backend`) — must have an entry here.

**When you add, rename, or remove a CloudFormation stack, update this document in the same commit.**

---

## Deployment model

The platform uses two separate deployment mechanisms:

- **`@derrops/infra` (CDK)** — long-lived infrastructure stacks deployed with `pnpm infra:deploy`. These are stable, change infrequently, and are the source of exports consumed by other stacks.
- **`@derrops/backend` (Amplify Gen 2)** — feature stacks deployed with `pnpm amplify:deploy`. Amplify auto-generates stack names; these stacks import from the CDK stacks via `Fn.importValue`.

### Deployment order

```
derrops--platform--vpc
  └── derrops--platform--security-groups
  └── derrops--platform--dns
  └── derrops--platform--app-database
  └── derrops--platform--opensearch

derrops--auth--cognito          (independent)
derrops--oaspec--source         (independent)

[Amplify: api Lambda stack]    (imports from all of the above)
[Amplify: indexer Lambda stack](imports from opensearch, oaspec--source)

derrops--platform--api-gateway  (imports Lambda ARN from Amplify — deploy last)
```

---

## CDK stacks (`packages/derrops-infra`)

### `derrops--platform--vpc`

| Field                | Value                                    |
| -------------------- | ---------------------------------------- |
| **Logical ID**       | `DerropsVpcStack`                         |
| **Class**            | `VpcStack`                               |
| **File**             | `packages/derrops-infra/lib/stack/vpc.ts` |
| **Domain / Service** | `platform` / `vpc`                       |
| **Dependencies**     | none                                     |

**Resources**: VPC, public/private/isolated subnets across 3 AZs, NAT Gateways, Internet Gateway, optional VPC Flow Log.

**Exports**:

- `derrops--platform--vpc--id`
- `derrops--platform--vpc--cidr-block`
- `derrops--platform--vpc--subnet-public-{a,b,c}`
- `derrops--platform--vpc--subnet-private-{a,b,c}`
- `derrops--platform--vpc--subnet-isolated-{a,b,c}`

---

### `derrops--platform--security-groups`

| Field                | Value                                               |
| -------------------- | --------------------------------------------------- |
| **Logical ID**       | `DerropsSecurityGroupStack`                          |
| **Class**            | `SecurityGroupStack`                                |
| **File**             | `packages/derrops-infra/lib/stack/security-group.ts` |
| **Domain / Service** | `platform` / `security-groups`                      |
| **Dependencies**     | `derrops--platform--vpc`                             |

**Resources**: Security groups for OpenSearch, Aurora, backend Lambda, and Cloud Lambda.

**Exports**:

- `derrops--platform--opensearch--sg-id`
- `derrops--platform--app-database--sg-id`
- `derrops--platform--backend--sg-id`
- `derrops--platform--cloud--sg-id`

---

### `derrops--platform--dns`

| Field                | Value                                                    |
| -------------------- | -------------------------------------------------------- |
| **Logical ID**       | `DerropsHostedZoneStack`                                  |
| **Class**            | `HostedZoneStack`                                        |
| **File**             | `packages/derrops-infra/lib/stack/private-hosted-zone.ts` |
| **Domain / Service** | `platform` / `dns`                                       |
| **Dependencies**     | `derrops--platform--vpc`                                  |

**Resources**: Route 53 private hosted zone associated with the VPC.

**Exports**:

- `derrops--platform--dns--hosted-zone-id`
- `derrops--platform--dns--hosted-zone-name`

---

### `derrops--platform--app-database`

| Field                | Value                                             |
| -------------------- | ------------------------------------------------- |
| **Logical ID**       | `DerropsDatabaseStack`                             |
| **Class**            | `AppDatabaseStack`                                |
| **File**             | `packages/derrops-infra/lib/stack/app-database.ts` |
| **Domain / Service** | `platform` / `app-database`                       |
| **Dependencies**     | `derrops--platform--vpc`                           |

**Resources**: Aurora Serverless v2 PostgreSQL cluster (writer + reader), Secrets Manager credentials, EC2 bastion host.

**Exports**:

- `derrops--platform--app-database--cluster-endpoint`
- `derrops--platform--app-database--cluster-read-endpoint`
- `derrops--platform--app-database--name`
- `derrops--platform--app-database--secret-arn`
- `derrops--platform--app-database--port`
- `derrops--platform--app-database--bastion-id`

---

### `derrops--platform--opensearch`

| Field                | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| **Logical ID**       | `DerropsOpenSearchStack`                                      |
| **Class**            | `OpenSearchStack`                                            |
| **File**             | `packages/derrops-infra/lib/stack/app-opensearch.ts`          |
| **Domain / Service** | `platform` / `opensearch`                                    |
| **Dependencies**     | `derrops--platform--vpc`, `derrops--platform--security-groups` |

**Resources**: OpenSearch Serverless collection (`derrops--opensearch`), VPC endpoint, network security policy, data access policy.

**Exports**:

- `derrops--platform--opensearch--collection-id`
- `derrops--platform--opensearch--collection-name`
- `derrops--platform--opensearch--collection-arn`
- `derrops--platform--opensearch--collection-endpoint`
- `derrops--platform--opensearch--dashboard-endpoint`
- `derrops--platform--opensearch--vpc-endpoint-id`

---

### `derrops--auth--cognito`

| Field                | Value                                         |
| -------------------- | --------------------------------------------- |
| **Logical ID**       | `DerropsAuthStack`                             |
| **Class**            | `AuthStack`                                   |
| **File**             | `packages/derrops-infra/lib/stack/userpool.ts` |
| **Domain / Service** | `auth` / `cognito`                            |
| **Dependencies**     | none                                          |

**Resources**: Cognito User Pool, User Pool Client, Identity Pool, pre-token-generation Lambda, SQS publish IAM role, identity pool authenticated IAM role.

**Exports**:

- `derrops--auth--cognito--user-pool-id`
- `derrops--auth--cognito--user-pool-arn`
- `derrops--auth--cognito--user-pool-client-id`
- `derrops--auth--cognito--user-pool-provider-name`
- `derrops--auth--cognito--user-pool-provider-url`
- `derrops--auth--cognito--identity-pool-id`
- `derrops--auth--cognito--identity-pool-auth-role-arn`
- `derrops--auth--cognito--sqs-publish-role-arn`

---

### `derrops--oaspec--source`

| Field                | Value                                                   |
| -------------------- | ------------------------------------------------------- |
| **Logical ID**       | `DerropsOpenApiBucketStack`                              |
| **Class**            | `OpenApiBucketStack`                                    |
| **File**             | `packages/derrops-infra/lib/stack/app-openapi-bucket.ts` |
| **Domain / Service** | `oaspec` / `source`                                     |
| **Dependencies**     | none                                                    |
| **Extra tag**        | `derrops:tenant-id: derrops`                              |

**Resources**: S3 bucket for Derrops-managed OpenAPI specifications (`{region}--{env}--derrops--derrops--oaspec--source--specs`). This is the platform's own OASpec catalogue sourced from APIs-guru and other curated collections.

**Exports**:

- `derrops--oaspec--source--bucket-arn`
- `derrops--oaspec--source--bucket-name`

---

### `derrops--platform--api-gateway`

| Field                | Value                                                               |
| -------------------- | ------------------------------------------------------------------- |
| **Logical ID**       | `DerropsApiStack`                                                    |
| **Class**            | `ApiStack`                                                          |
| **File**             | `packages/derrops-infra/lib/stack/apigateway.ts`                     |
| **Domain / Service** | `platform` / `api-gateway`                                          |
| **Dependencies**     | Amplify API Lambda stack (Lambda ARN passed via env or CDK context) |

**Deploy condition**: Only deployed when `LAMBDA_FUNCTION_ARN` env var or `lambdaFunctionArn` CDK context value is provided. Deploy the Amplify backend first.

**Resources**: API Gateway REST API proxying to the NestJS API Lambda, CloudWatch access logging, usage plan with rate limiting (50 req/s, 100 burst).

**Exports**:

- `derrops--platform--api-gateway--url`
- `derrops--platform--api-gateway--id`
- `derrops--platform--api-gateway--arn`
- `derrops--platform--api-gateway--endpoint`

---

## Amplify stacks (`packages/derrops-backend`)

Amplify Gen 2 auto-generates CloudFormation stack names at deploy time. The logical resource IDs and the exports they produce are documented below. Imports consumed from CDK stacks are also listed.

### API Lambda stack

**Amplify resource**: `backend.api` (function: `amplify/functions/api/`)

**Imports from CDK**:

- `derrops--platform--app-database--cluster-endpoint`
- `derrops--platform--app-database--secret-arn`
- `derrops--auth--cognito--user-pool-id`
- `derrops--platform--vpc--id`
- `derrops--platform--cloud--sg-id`
- `derrops--platform--vpc--subnet-private-{a,b,c}`
- `derrops--platform--opensearch--collection-endpoint`
- `derrops--platform--opensearch--collection-arn`

**Exports**:

- `derrops--platform--api--lambda-arn`
- `derrops--platform--api--lambda-name`

---

### OpenAPI Indexer Lambda stack

**Amplify resource**: `backend.openapiIndexer` (function: `amplify/functions/openapi-indexer/`)

**Imports from CDK**:

- `derrops--platform--opensearch--collection-endpoint`
- `derrops--platform--opensearch--collection-arn`
- `derrops--oaspec--source--bucket-arn`
- `derrops--oaspec--source--bucket-name`
- `derrops--platform--cloud--sg-id`
- `derrops--platform--vpc--subnet-private-{a,b,c}`

**Exports**:

- `derrops--oaspec--indexer--lambda-arn`
- `derrops--oaspec--storage--bucket-name`
- `derrops--oaspec--staging--bucket-name`

**Resources**: OASpec storage bucket (versioned, retained on destroy), OASpec staging bucket (ephemeral, auto-delete on destroy). S3 event notifications trigger the indexer on object create/remove under the `APIs/` prefix.

---

## Related documents

- [Platform Domains](./platform-domains) — domain registry and CDK tag values
- [Tagging Conventions](./tagging-conventions) — required tags and CDK enforcement
- [CDK Naming & Tagging Audit](./cdk-naming-tagging-audit) — verified current names and exports
- [Multi-Tenancy](./multi-tenancy) — per-tenant stacks (future)
