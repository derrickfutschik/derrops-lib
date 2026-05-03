---
id: platform-domains
title: Platform Domains
sidebar_label: Platform Domains
sidebar_position: 5
tags:
  - infrastructure
  - architecture
  - iac
  - tagging
---

# Platform Domains

A **domain** is a named functional boundary that groups related AWS resources, services, and code under a single area of responsibility. Every CDK resource carries a `derrops:domain` tag; every documentation page carries the matching Docusaurus tag. This keeps cost allocation, access control, and documentation navigation consistently aligned.

## Domain registry

| Domain            | CDK tag value                     | Responsibility                                                                         |
| ----------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| `platform`        | `derrops:domain:platform`          | Shared networking, compute, and storage that all other domains build on                |
| `user-management` | `derrops:domain:user-management`   | Everything concerned with who can access the platform — sign-up, sign-in, session tokens, and machine identity |
| `security`        | `derrops:domain:security`          | Cross-cutting controls that protect the whole platform — encryption, certificates, firewall rules, and compliance |
| `oaspec`          | `derrops:domain:oaspec`            | Storage, indexing, and retrieval of OpenAPI specification documents across their full lifecycle |
| `relay`           | `derrops:domain:relay`             | Traffic capture and forwarding — proxy components that route API calls from a customer's environment to the platform |
| `logging`         | `derrops:domain:logging`           | The pipeline that turns raw HTTP captures into enriched, queryable log records          |
| `portal`          | `derrops:domain:portal`            | The customer-facing web experience — dashboards, configuration, analytics, and alerts  |

---

## `platform`

**Tag value**: `derrops:domain:platform`

Foundational resources that every other domain builds on — networking, shared data stores, the API surface, and base compute primitives. A resource belongs here if it is not specific to any single feature and other domains would need to reference it. No feature domain should take a hard dependency on another feature domain's internals; those shared primitives go here instead.

**Includes**:

- VPC, subnets, NAT gateways, route tables (`derrops--platform--vpc`)
- Aurora Serverless v2 PostgreSQL cluster (`derrops--platform--app-database`)
- OpenSearch Serverless collection (`derrops--platform--opensearch`)
- API Gateway REST API (`derrops--platform--api-gateway`)
- Security groups (`derrops--platform--security-groups`)
- Route 53 private hosted zone (`derrops--platform--dns`)
- API Lambda function (`derrops--platform--api`)

**CDK stacks**: `derrops--platform--vpc`, `derrops--platform--app-database`, `derrops--platform--opensearch`, `derrops--platform--api-gateway`, `derrops--platform--security-groups`, `derrops--platform--dns`

---

## `user-management`

**Tag value**: `derrops:domain:user-management`

Resources responsible for authenticating users and machines, managing their identities, and issuing tokens. Put a resource here if it decides *who* can access the platform or *what identity* an automated client presents. This includes the user lifecycle (sign-up through deletion), session management, and the credential grants that let relay instances and Lambda functions authenticate.

**Includes**:

- Cognito User Pool and User Pool Client (`derrops--user-management--cognito`)
- Cognito Identity Pool for relay IAM identity (`derrops--user-management--identity-pool`)
- Pre-token-generation Lambda — injects `tenantId`, `relayId` custom claims (`derrops--user-management--jwt-lambda`)
- SQS publish IAM role for relay identity
- Identity pool authenticated IAM role
- User profile and tenant membership store

**CDK stacks**: `derrops--user-management--cognito`

---

## `security`

**Tag value**: `derrops:domain:security`

Cross-cutting controls whose primary job is protection rather than feature delivery. A resource belongs here if it is shared across multiple domains and exists to enforce security — encryption at rest, TLS termination, traffic filtering, secret storage, and compliance checks. Feature domains reference these resources; they do not own them.

**Includes**:

- KMS keys and aliases for at-rest encryption across S3, DynamoDB, RDS, and Secrets Manager (`derrops--security--kms`)
- ACM TLS certificates for API Gateway and portal CloudFront (`derrops--security--certificates`)
- Secrets Manager entries for shared platform credentials (`derrops--security--secrets--{key}`)
- WAF WebACL protecting API Gateway from common attack vectors (`derrops--security--waf`)
- AWS Config rules enforcing required tags and encryption; Security Hub insights (`derrops--security--compliance`)

**CDK stacks**: none yet — planned

---

## `oaspec`

**Tag value**: `derrops:domain:oaspec`

Resources that manage OpenAPI specification documents across their full lifecycle. A resource belongs here if its primary function is to read, write, transform, store, or index an OASpec document — from the moment a spec arrives (external source or tenant upload) through validation, per-tenant storage, event-driven indexing, and search.

**Includes**:

- Derrops-managed source S3 bucket (APIs-guru and platform-curated specs) (`derrops--oaspec--source`)
- Per-tenant OASpec storage buckets (`{region}--{env}--derrops--{tenantId}--oaspec--storage--specs`)
- OpenAPI Indexer Lambda — event-driven S3 → OpenSearch pipeline (`derrops--oaspec--indexer`)
- OASpec storage bucket — validated spec store (`derrops--oaspec--storage`)
- OASpec staging bucket — transient upload landing zone (`derrops--oaspec--staging`)
- OpenSearch indices `oaspec-derrops` and `oaspec-{tenantId}`
- Per-tenant search alias `oaspec-search-{tenantId}`

**CDK stacks**: `derrops--oaspec--source` (infra), indexer and buckets in `derrops-backend` Amplify stack

**Design docs**:

- [OpenAPI Directory Indexer](../openapi-indexer/openapi-directory-indexer)
- [OpenAPI Index Access Pattern](../openapi-indexer/openapi-index-access-pattern)

---

## `relay`

**Tag value**: `derrops:domain:relay`

Resources involved in capturing API traffic from a customer environment and routing it to the platform. A resource belongs here if it runs — or directly supports something running — inside or alongside the customer's network: proxy runtimes, credential brokers that prevent secrets reaching log records, relay instance registries, and the IAM identities those runtimes assume.

**Includes**:

- Cloud Relay service (customer-side Docker/Lambda proxy)
- Local development relay (reverse-proxy for local testing without cloud round-trip)
- Aegis Token Broker (credential injection layer — prevents secrets reaching relay logs)
- Per-relay IAM identity and SQS publish permissions
- Relay connection and trust model

**Design docs**:

- [Cloud Relay Component](../cloud-relay/component-cloud-relay)
- [Network Topology](../cloud-relay/network-topology)
- [Relay Connection](../cloud-relay/relay-connection)
- [Aegis Token Broker](../cloud-relay/aegis-token-broker-design)
- [Local Relay](../cloud-relay/local-relay)
- [Cloud Relay Security](../cloud-relay/cloud-relay-security)

---

## `logging`

**Tag value**: `derrops:domain:logging`

Resources that handle HTTP log data after it leaves a relay. A resource belongs here if its job is to move, transform, store, or retrieve log records — intake queues and endpoints, enrichment pipelines that annotate each record with OASpec metadata, durable per-tenant storage, and query surfaces. The relay domain captures traffic; this domain processes it.

**Includes**:

- Log ingestion API endpoint (receives events from relay)
- Request enrichment pipeline (OASpec lookup → annotation)
- Per-tenant log S3 buckets (`{region}--{env}--derrops--{tenantId}--logging--storage--logs`)
- Aurora tables for structured log storage
- Log query and aggregation services

**Multi-tenancy**: each tenant has a dedicated S3 bucket for raw logs. See [Multi-Tenancy](./multi-tenancy) for the resource catalogue.

---

## `portal`

**Tag value**: `derrops:domain:portal`

Resources that power the customer-facing web experience. A resource belongs here if it exists to render information to, or collect configuration from, a human user of the platform — front-end assets, portal-specific backend services, metric aggregation for display, and notification delivery triggered by user-defined alert rules.

**Includes**:

- React web application (`apps/derrops-portal`)
- Dashboards: service health, SLA trend charts, API performance metrics
- Cost analysis views
- Alert management and notification rules
- Service and relay configuration UI
- OASpec catalogue browser

---

## Using domains in CDK

Apply the domain tag inside each stack constructor via `Tags.of(this)`:

```typescript
import * as cdk from 'aws-cdk-lib'
import { Tags } from 'aws-cdk-lib'

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    // derrops:org, derrops:env, derrops:managed-by applied via Tags.of(app) in bin/cdk.ts
    Tags.of(this).add('derrops:domain', 'user-management')
    Tags.of(this).add('derrops:service', 'cognito')
  }
}
```

Stack names follow `derrops--{domain}--{service}` (no `--stack` suffix). CloudFormation export names follow `derrops--{domain}--{service}--{key}`.

See [Tagging Conventions](./tagging-conventions) for the full tag specification and CDK enforcement patterns.

## Using domains in documentation

Each doc page in `docs/` or `design/` should carry the matching domain tag in its frontmatter alongside any other relevant tags:

```yaml
---
tags:
  - oaspec
  - data-pipeline
---
```

This allows readers to navigate all content for a given domain at `/docs/tags/oaspec` or `/design/tags/oaspec`.
