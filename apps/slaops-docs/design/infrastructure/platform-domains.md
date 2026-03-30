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

A **domain** is a named functional boundary that groups related AWS resources, services, and code under a single area of responsibility. Every CDK resource carries a `slaops:domain` tag; every documentation page carries the matching Docusaurus tag. This keeps cost allocation, access control, and documentation navigation consistently aligned.

## Domain registry

| Domain | CDK tag value | Responsibility |
|---|---|---|
| `platform` | `slaops:domain: platform` | Core shared infrastructure |
| `auth` | `slaops:domain: auth` | Authentication and authorization |
| `oaspec` | `slaops:domain: oaspec` | OpenAPI specification management |
| `relay` | `slaops:domain: relay` | Cloud Relay and local dev relay |
| `logging` | `slaops:domain: logging` | HTTP log ingestion and enrichment |
| `portal` | `slaops:domain: portal` | Web portal and dashboards |

---

## `platform`

**Tag value**: `slaops:domain: platform`

Core shared infrastructure that underpins every other domain. No feature domain should take a hard dependency on another feature domain's internals; all cross-cutting concerns go here.

**Includes**:
- VPC, subnets, NAT gateways, route tables (`slaops--platform--vpc`)
- Aurora Serverless v2 PostgreSQL cluster (`slaops--platform--app-database`)
- OpenSearch Serverless collection (`slaops--platform--opensearch`)
- API Gateway REST API (`slaops--platform--api-gateway`)
- Security groups (`slaops--platform--security-groups`)
- Route 53 private hosted zone (`slaops--platform--dns`)
- API Lambda function (`slaops--platform--api`)

**CDK stacks**: `slaops--platform--vpc`, `slaops--platform--app-database`, `slaops--platform--opensearch`, `slaops--platform--api-gateway`, `slaops--platform--security-groups`, `slaops--platform--dns`

---

## `auth`

**Tag value**: `slaops:domain: auth`

Authentication and authorization. Manages all identity primitives used across the platform: user identity, machine identity (IAM roles for Lambda / relay / Aegis), and token issuance.

**Includes**:
- Cognito User Pool and User Pool Client (`slaops--auth--cognito`)
- Cognito Identity Pool for relay identity
- Pre-token-generation Lambda (custom claims injection)
- SQS publish IAM role for relay identity
- Identity pool authenticated IAM role

**CDK stacks**: `slaops--auth--cognito`

---

## `oaspec`

**Tag value**: `slaops:domain: oaspec`

OpenAPI specification management. Covers the full lifecycle of an OASpec: ingest from external sources or tenant upload → validate → index into OpenSearch → serve via alias-based search.

**Includes**:
- SLAOps-managed source S3 bucket (APIs-guru and platform-curated specs) (`slaops--oaspec--source`)
- Per-tenant OASpec storage buckets (`{region}--{env}--slaops--{tenantId}--oaspec--storage--specs`)
- OpenAPI Indexer Lambda — event-driven S3 → OpenSearch pipeline (`slaops--oaspec--indexer`)
- OASpec storage bucket — validated spec store (`slaops--oaspec--storage`)
- OASpec staging bucket — transient upload landing zone (`slaops--oaspec--staging`)
- OpenSearch indices `oaspec-slaops` and `oaspec-{tenantId}`
- Per-tenant search alias `oaspec-search-{tenantId}`

**CDK stacks**: `slaops--oaspec--source` (infra), indexer and buckets in `slaops-backend` Amplify stack

**Design docs**:
- [OpenAPI Directory Indexer](../openapi-indexer/openapi-directory-indexer)
- [OpenAPI Index Access Pattern](../openapi-indexer/openapi-index-access-pattern)

---

## `relay`

**Tag value**: `slaops:domain: relay`

Cloud Relay and the local development relay. This is the customer-deployed HTTP proxy component that intercepts API traffic, enriches it with SLAOps metadata, and forwards it to the platform ingestion endpoint.

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

**Tag value**: `slaops:domain: logging`

HTTP request/response log ingestion, enrichment, and storage. Receives captured traffic from relay instances, enriches each log entry with matched OASpec metadata (operation, parameters, schema), and persists to the queryable store.

**Includes**:
- Log ingestion API endpoint (receives events from relay)
- Request enrichment pipeline (OASpec lookup → annotation)
- Per-tenant log S3 buckets (`{region}--{env}--slaops--{tenantId}--logging--storage--logs`)
- Aurora tables for structured log storage
- Log query and aggregation services

**Multi-tenancy**: each tenant has a dedicated S3 bucket for raw logs. See [Multi-Tenancy](./multi-tenancy) for the resource catalogue.

---

## `portal`

**Tag value**: `slaops:domain: portal`

Web portal for monitoring, management, and analysis. The customer-facing dashboard that surfaces SLA compliance, API performance metrics, cost analysis, and alert management.

**Includes**:
- React web application (`apps/slaops-portal`)
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

    // slaops:org, slaops:env, slaops:managed-by applied via Tags.of(app) in bin/cdk.ts
    Tags.of(this).add('slaops:domain', 'oaspec')
    Tags.of(this).add('slaops:service', 'indexer')
  }
}
```

Stack names follow `slaops--{domain}--{service}` (no `--stack` suffix). CloudFormation export names follow `slaops--{domain}--{service}--{key}`.

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
