---
id: service-registry
title: Domain & Service Registry
sidebar_label: Domain & Service Registry
sidebar_position: 6
created_at: 2026-05-02
updated_at: 2026-05-02
implemented_at: ~
implements: ~
author: Derrick Futschik
status: proposed
tags:
  - infrastructure
  - tagging
  - iac
  - architecture
  - platform
---

# Domain & Service Registry

This is the authoritative registry of every `derrops:domain` + `derrops:service` combination used across the platform. Every CDK resource, IAM policy, CloudFormation export name, and S3 bucket name is built from these two segments via `DerropsConventions`.

**Start here when:**

- Adding a new AWS resource or CDK stack — pick the right domain and service before naming anything.
- Writing a design doc — use the domain tag from the registry so it aligns with the CDK tags.
- Reviewing cost reports — the `derrops:service` tag maps directly to rows in Cost Explorer.

See [Platform Domains](./platform-domains) for domain responsibilities and [Tagging Conventions](./tagging-conventions) for the full tag specification.

---

## Master reference table

| Domain     | Service            | Status    | Generated name prefix                   | Responsibility                                |
| ---------- | ------------------ | --------- | --------------------------------------- | --------------------------------------------- |
| `platform` | `vpc`              | Active    | `derrops--platform--vpc`                 | VPC, subnets, NAT gateways, route tables      |
| `platform` | `app-database`     | Active    | `derrops--platform--app-database`        | Aurora Serverless v2 PostgreSQL cluster       |
| `platform` | `opensearch`       | Active    | `derrops--platform--opensearch`          | OpenSearch Serverless collection              |
| `platform` | `api-gateway`      | Active    | `derrops--platform--api-gateway`         | API Gateway REST API and usage plans          |
| `platform` | `security-groups`  | Active    | `derrops--platform--security-groups`     | Shared security group definitions             |
| `platform` | `dns`              | Active    | `derrops--platform--dns`                 | Route 53 private hosted zone                  |
| `platform` | `api`              | Active    | `derrops--platform--api`                 | Core API Lambda function                      |
| `platform` | `cdn`              | Suggested | `derrops--platform--cdn`                 | CloudFront distribution for portal assets     |
| `platform` | `tenant-registry`  | Suggested | `derrops--platform--tenant-registry`     | Tenant provisioning and lifecycle management  |
| `platform` | `monitoring`       | Suggested | `derrops--platform--monitoring`          | CloudWatch dashboards, alarms, log groups     |
| `user-management` | `cognito`     | Active    | `derrops--user-management--cognito`      | Cognito User Pool, App Client, User Pool Domain |
| `user-management` | `identity-pool` | Planned | `derrops--user-management--identity-pool` | Cognito Identity Pool for relay IAM identity |
| `user-management` | `jwt-lambda`  | Planned   | `derrops--user-management--jwt-lambda`   | Pre-token-generation Lambda (custom claims)   |
| `user-management` | `users`       | Suggested | `derrops--user-management--users`        | User profile, preferences, and tenant membership |
| `security` | `certificates`     | Suggested | `derrops--security--certificates`        | ACM TLS certificates shared across domains    |
| `security` | `kms`              | Suggested | `derrops--security--kms`                 | KMS keys and aliases for at-rest encryption   |
| `security` | `secrets`          | Suggested | `derrops--security--secrets`             | Secrets Manager for shared platform secrets   |
| `security` | `waf`              | Suggested | `derrops--security--waf`                 | WAF WebACL protecting API Gateway             |
| `security` | `compliance`       | Suggested | `derrops--security--compliance`          | AWS Config rules, Security Hub insights       |
| `oaspec`   | `source`           | Active    | `derrops--oaspec--source`                | Derrops-managed source spec S3 bucket          |
| `oaspec`   | `storage`          | Active    | `derrops--oaspec--storage`               | Validated per-tenant spec storage             |
| `oaspec`   | `staging`          | Active    | `derrops--oaspec--staging`               | Transient upload landing zone                 |
| `oaspec`   | `indexer`          | Active    | `derrops--oaspec--indexer`               | S3 → OpenSearch indexing Lambda               |
| `oaspec`   | `dynamodb-cache`   | Active    | `derrops--oaspec--dynamodb-cache`        | DynamoDB hot-path cache for spec lookups      |
| `oaspec`   | `search`           | Planned   | `derrops--oaspec--search`                | OpenSearch query and alias management         |
| `relay`    | `cloud-relay`      | Planned   | `derrops--relay--cloud-relay`            | Cloud-hosted relay proxy container/Lambda     |
| `relay`    | `local-relay`      | Planned   | `derrops--relay--local-relay`            | Local development relay binary distribution   |
| `relay`    | `aegis`            | Planned   | `derrops--relay--aegis`                  | Aegis Token Broker service                    |
| `relay`    | `relay-registry`   | Suggested | `derrops--relay--relay-registry`         | Registry and lifecycle management of relays   |
| `logging`  | `ingestion`        | Planned   | `derrops--logging--ingestion`            | HTTP event ingestion API endpoint             |
| `logging`  | `enrichment`       | Planned   | `derrops--logging--enrichment`           | OASpec-based log enrichment pipeline Lambda   |
| `logging`  | `storage`          | Planned   | `derrops--logging--storage`              | Per-tenant log S3 buckets and Aurora tables   |
| `logging`  | `query`            | Planned   | `derrops--logging--query`                | Log retrieval, aggregation, and export        |
| `logging`  | `alerts`           | Suggested | `derrops--logging--alerts`               | Alert rule evaluation and notification fanout |
| `portal`   | `frontend`         | Planned   | `derrops--portal--frontend`              | React web app (Amplify Hosting)               |
| `portal`   | `analytics`        | Suggested | `derrops--portal--analytics`             | SLA metrics, cost analysis, trend computation |
| `portal`   | `notifications`    | Suggested | `derrops--portal--notifications`         | Alert delivery — email, Slack, webhooks       |

**Status key:**

| Status    | Meaning                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Active    | CDK stack or Amplify resource provisioned and deployed                                                     |
| Planned   | Covered by an existing design doc; CDK resources not yet written                                           |
| Suggested | Proposed here; no existing design or infrastructure — evaluate before adopting                             |

---

## `platform` domain

Core shared infrastructure. All other domains depend on resources in `platform` — they never take direct dependencies on each other.

```typescript
const orgConvention = new DerropsConventions({ org: 'derrops', env, region })
  .arnContext({ accountId })
  .tagPrefix('derrops:')
  .tagKeys('org', 'domain', 'service')

const platform = orgConvention.with({ domain: 'platform' })

const vpc         = platform.with({ service: 'vpc' })
const db          = platform.with({ service: 'app-database' })
const opensearch  = platform.with({ service: 'opensearch' })
const apiGateway  = platform.with({ service: 'api-gateway' })
const sg          = platform.with({ service: 'security-groups' })
const dns         = platform.with({ service: 'dns' })
const api         = platform.with({ service: 'api' })
```

### Services

| Service           | Active? | Key resources generated                                                                               |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `vpc`             | ✅      | `derrops--platform--vpc`, subnet exports `derrops--platform--vpc--subnet-private-{az}`                 |
| `app-database`    | ✅      | `derrops--platform--app-database`, SSM param `derrops--platform--app-database--endpoint`               |
| `opensearch`      | ✅      | `derrops--platform--opensearch`, `derrops--platform--opensearch--endpoint`                              |
| `api-gateway`     | ✅      | `derrops--platform--api-gateway`, `derrops--platform--api-gateway--rest-api-id`                        |
| `security-groups` | ✅      | `derrops--platform--security-groups--lambda`, `derrops--platform--security-groups--rds`                |
| `dns`             | ✅      | `derrops--platform--dns--hosted-zone-id`, `derrops--platform--dns--hosted-zone-name`                   |
| `api`             | ✅      | `derrops--platform--api` (Lambda function name)                                                        |
| `cdn`             | ➕      | `derrops--platform--cdn`, `derrops--platform--cdn--distribution-id`                                    |
| `tenant-registry` | ➕      | `derrops--platform--tenant-registry`, DynamoDB table for tenant records                                |
| `monitoring`      | ➕      | `derrops--platform--monitoring--dashboard`, CW log groups                                              |

---

## `user-management` domain

User identity, authentication, and session management. Owns all Cognito primitives: the User Pool, App Clients, token customisation, and the Identity Pool that grants relay instances their IAM identity.

```typescript
const userMgmt = orgConvention.with({ domain: 'user-management' })

const cognito      = userMgmt.with({ service: 'cognito' })
const identityPool = userMgmt.with({ service: 'identity-pool' })
const jwtLambda    = userMgmt.with({ service: 'jwt-lambda' })
const users        = userMgmt.with({ service: 'users' })
```

Sub-segments for Cognito sub-resources:

```typescript
// User Pool and App Client use the 'key' segment for disambiguation
cognito.name({ type: 'cognitoUserPool' })                     // derrops--user-management--cognito
cognito.name({ type: 'cognitoUserPool', key: 'app-client' })  // derrops--user-management--cognito--app-client
```

### Services

| Service         | Active? | Key resources generated                                                                              |
| --------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `cognito`       | ✅      | Cognito User Pool, App Client, User Pool Domain; exports `derrops--user-management--cognito--pool-id` |
| `identity-pool` | 🔲      | Cognito Identity Pool; IAM authenticated role for relay SQS publish                                 |
| `jwt-lambda`    | 🔲      | Pre-token-generation Lambda that injects `tenantId`, `relayId` custom claims                        |
| `users`         | ➕      | User profile and tenant membership DynamoDB table or Aurora schema                                   |

---

## `security` domain

Platform-wide security primitives shared across all domains: encryption keys, certificates, secret management, WAF rules, and compliance monitoring. Resources here are referenced by other domains but owned here.

```typescript
const security = orgConvention.with({ domain: 'security' })

const kms          = security.with({ service: 'kms' })
const secrets      = security.with({ service: 'secrets' })
const certificates = security.with({ service: 'certificates' })
const waf          = security.with({ service: 'waf' })
const compliance   = security.with({ service: 'compliance' })
```

### Services

| Service        | Active? | Key resources generated                                                                        |
| -------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `certificates` | ➕      | ACM certificates `derrops--security--certificates--api`, `derrops--security--certificates--portal` |
| `kms`          | ➕      | KMS key `derrops--security--kms`, aliases per consuming service                                 |
| `secrets`      | ➕      | Secrets Manager `derrops--security--secrets--{key}` for shared platform credentials             |
| `waf`          | ➕      | WAF WebACL `derrops--security--waf`, IP sets, rule groups                                       |
| `compliance`   | ➕      | Config rule `derrops--security--compliance--required-tags`, Security Hub insight                |

---

## `oaspec` domain

OpenAPI specification management. Covers the full OASpec lifecycle: ingest → validate → index → search.

```typescript
const oaspec = orgConvention.with({ domain: 'oaspec' })

const source       = oaspec.with({ service: 'source' })
const storage      = oaspec.with({ service: 'storage' })
const staging      = oaspec.with({ service: 'staging' })
const indexer      = oaspec.with({ service: 'indexer' })
const cache        = oaspec.with({ service: 'dynamodb-cache' })
const search       = oaspec.with({ service: 'search' })
```

Per-tenant resources include the `tenant` segment:

```typescript
// Per-tenant storage bucket:
// {region}--{env}--derrops--{tenantId}--oaspec--storage--specs
oaspec.name({ type: 's3Bucket', service: 'storage', tenant: tenantId, key: 'specs' })
```

### Services

| Service          | Active? | Key resources generated                                                                          |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `source`         | ✅      | S3 bucket `{region}--{env}--derrops--oaspec--source--specs`                                      |
| `storage`        | ✅      | Per-tenant S3 `{region}--{env}--derrops--{tenantId}--oaspec--storage--specs`                     |
| `staging`        | ✅      | Per-tenant S3 `{region}--{env}--derrops--{tenantId}--oaspec--staging--uploads`                   |
| `indexer`        | ✅      | Lambda `derrops--oaspec--indexer`, OpenSearch index `oaspec-{tenantId}`, alias `oaspec-search-{tenantId}` |
| `dynamodb-cache` | ✅      | DynamoDB table `derrops--oaspec--dynamodb-cache`, GSI `derrops--oaspec--dynamodb-cache--gsi-...`  |
| `search`         | 🔲      | OpenSearch query Lambda, IAM role for index read                                                 |

---

## `relay` domain

Cloud Relay and local development relay. The customer-deployed HTTP proxy that intercepts API traffic and forwards it to the Derrops ingestion endpoint.

```typescript
const relay = orgConvention.with({ domain: 'relay' })

const cloudRelay    = relay.with({ service: 'cloud-relay' })
const localRelay    = relay.with({ service: 'local-relay' })
const aegis         = relay.with({ service: 'aegis' })
const relayRegistry = relay.with({ service: 'relay-registry' })
```

Per-relay IAM identity uses the `tenant` segment:

```typescript
// IAM role for a specific relay instance:
relay.name({ type: 'iamRole', service: 'cloud-relay', tenant: relayId })
```

### Services

| Service          | Active? | Key resources generated                                                                        |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `cloud-relay`    | 🔲      | Docker image repo `derrops--relay--cloud-relay`, Lambda/ECS task definition, per-relay IAM role |
| `local-relay`    | 🔲      | Distribution S3 bucket, CLI binary versioning prefix                                           |
| `aegis`          | 🔲      | Aegis Token Broker Lambda, KMS key for credential envelope encryption                          |
| `relay-registry` | ➕      | DynamoDB table tracking active relay instances, connection state, and trust records             |

---

## `logging` domain

HTTP request/response log ingestion, enrichment, and storage. Receives captured traffic from relay instances and enriches each entry with OASpec metadata.

```typescript
const logging = orgConvention.with({ domain: 'logging' })

const ingestion  = logging.with({ service: 'ingestion' })
const enrichment = logging.with({ service: 'enrichment' })
const storage    = logging.with({ service: 'storage' })
const query      = logging.with({ service: 'query' })
const alerts     = logging.with({ service: 'alerts' })
```

Per-tenant log storage:

```typescript
// {region}--{env}--derrops--{tenantId}--logging--storage--logs
logging.name({ type: 's3Bucket', service: 'storage', tenant: tenantId, key: 'logs' })
```

### Services

| Service     | Active? | Key resources generated                                                                    |
| ----------- | ------- | ------------------------------------------------------------------------------------------ |
| `ingestion` | 🔲      | API Gateway route `/logs`, Lambda handler, SQS ingestion queue                             |
| `enrichment`| 🔲      | SQS consumer Lambda, DynamoDB lookup for OASpec cache, Aurora write                        |
| `storage`   | 🔲      | Per-tenant S3 `{region}--{env}--derrops--{tenantId}--logging--storage--logs`, Aurora tables |
| `query`     | 🔲      | Log query Lambda, Aurora read role, presigned S3 export                                    |
| `alerts`    | ➕      | Alert evaluation Lambda, SNS topic for fanout, SES/Slack integrations                      |

---

## `portal` domain

Customer-facing web portal: monitoring dashboards, SLA trend charts, API performance metrics, cost analysis, alert management, and relay configuration.

```typescript
const portal = orgConvention.with({ domain: 'portal' })

const frontend     = portal.with({ service: 'frontend' })
const analytics    = portal.with({ service: 'analytics' })
const notifications = portal.with({ service: 'notifications' })
```

### Services

| Service         | Active? | Key resources generated                                                              |
| --------------- | ------- | ------------------------------------------------------------------------------------ |
| `frontend`      | 🔲      | Amplify Hosting app, CloudFront distribution alias, S3 deployment bucket             |
| `analytics`     | ➕      | Lambda for SLA metric aggregation, CloudWatch metric namespace `derrops/portal`       |
| `notifications` | ➕      | SNS topic for alert delivery, Lambda for Slack/email webhook fanout                  |

---

## Adding a new service

1. Check this registry — is there an existing service that covers your use case?
2. Pick the domain (see [Platform Domains](./platform-domains) if unsure).
3. Choose a kebab-case service name that is descriptive, stable, and unique within the domain.
4. Add the service to this registry table with status `Planned` or `Active`.
5. Instantiate the convention in the relevant package:
   ```typescript
   const myService = domainConvention.with({ service: 'my-service' })
   ```
6. Apply tags via `myService.applyTags((k, v) => Tags.of(construct).add(k, v))`.
7. If the name will be referenced across packages, add it to `packages/derrops-config/src/`.

**Service name rules:**

- Kebab-case only: `my-service`, not `myService` or `my_service`.
- Stable and technology-agnostic: name the capability, not the current implementation (`storage` not `s3-storage`).
- No domain prefix in the service name — the domain is already a separate segment (`logging.storage`, not `logging.logging-storage`).
- Avoid generic names like `service`, `data`, `handler` — be specific.

---

## Adding a new domain

Adding a domain is a larger change that affects tagging, documentation, and billing reports. Before creating a new domain ask: does this sit comfortably inside an existing domain? If not:

1. Propose the new domain in this registry and [Platform Domains](./platform-domains).
2. Add the domain tag to `apps/derrops-docs/internal/platform/design/tags.yml`.
3. Update the `tagKeys` on the org-level convention instance in `packages/derrops-config/src/config.ts`.
4. Update the `CLAUDE.md` domain tag reference in `apps/derrops-docs/internal/platform/design/CLAUDE.md`.
5. Deploy a CDK Config rule update so the new domain value is recognised as valid.
