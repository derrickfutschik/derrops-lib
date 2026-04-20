---
id: index
title: Design
sidebar_label: Overview
sidebar_position: 1
---

# Design

:::note Internal documentation
This section is for **platform engineers** building and maintaining SLAOps. It contains architecture decision records, component designs, IaC conventions, and implementation detail. It is not intended for customers evaluating or using the platform.

For customer-facing documentation, see the [Docs](/docs/intro) section.
:::

Design documents serve two purposes:

1. **Architecture records** — capture decisions, tradeoffs, and the reasoning behind how components are built so future engineers (and AI coding assistants) understand context
2. **Implementation guides** — provide enough detail that a new engineer (or an AI) can implement or extend a component correctly without re-deriving the design

## Sections

### [Cloud Relay](./cloud-relay)

The customer-deployed HTTP proxy for API testing. Covers component design, network topology, connection trust model, Aegis Token Broker (credential injection), local development relay, and security/auth methods.

- [API Tester — Relay Execution](./cloud-relay/api-tester-relay-execution) — End-to-end job execution flow from portal through slaops-cloud and SQS to relay
- [API Tester — Connection Switcher](./cloud-relay/api-tester-connection-switcher) — UX and state design for switching between relay connections and browser-direct mode

### [OpenAPI Indexer](./openapi-indexer/index.md)

Design for the OASpec domain: API and OpenAPI spec management, five-index OpenSearch architecture, sequential indexing pipeline, search use-cases, and portal UI.

- [API & OASpec Data Model](./openapi-indexer/api-oaspec-data-model) — SQL entities for APIs and OASpec records; API-first constraint; multi-tenancy
- [OpenSearch Indices](./openapi-indexer/opensearch-indices) — Five dedicated indices (spec, server, operation, parameter, model); versioning strategy and retention
- [Indexing Pipeline](./openapi-indexer/indexing-pipeline) — Six-step sequential indexing flow; version lifecycle; indexing response stats
- [Search Design](./openapi-indexer/search-design) — Operation, server, API, parameter, and model search; host-shape matching; enrichment lookup
- [UI Design](./openapi-indexer/ui-design) — APIs tab; upload wizard; version browser; diff view; operation explorer
- [New API Wizard](./openapi-indexer/new-api-wizard) — `/apis/new` wizard Redux slice, External URL auto-populate via `GET /apis/info`, and component tree
- [Tab Views](./openapi-indexer/views/index.md) — Backend endpoints and frontend design for the five API detail tabs: Versions, Operations, Servers, Parameters, Models
- [OpenAPI Index Access Pattern](./openapi-indexer/openapi-index-access-pattern) — Two-tier multi-tenant index architecture: SLAOps managed public catalogue (`oaspec-slaops`) and per-tenant private indices

### [Infrastructure](./infrastructure)

Platform-wide infrastructure design: tenancy model, per-tenant resource catalogue, IaC provisioning via CDK, AWS resource tagging, and access control.

- [Platform Domains](./infrastructure/platform-domains) — authoritative registry of all platform domains (`platform`, `auth`, `oaspec`, `relay`, `logging`, `portal`), with CDK tag values and the services each domain owns
- [Multi-Tenancy](./infrastructure/multi-tenancy) — TenantConstruct, dedicated S3 buckets, OpenSearch index/alias lifecycle, IAM scoping, tenant lifecycle management
- [Tagging Conventions](./infrastructure/tagging-conventions) — required tags, CDK `Tags.of()` enforcement, cost allocation, IAM condition key patterns
- [CDK Naming & Tagging Audit](./infrastructure/cdk-naming-tagging-audit) — current-state violations table and remediation priority (P0: tags, P1–P2: export renames, P3: physical resource renames)

### [Component Proposal Process](./process/component-proposal-standard)

Standards and templates for proposing new platform components — how to write a proposal, the lifecycle from draft to implemented, and a worked example.

## Tags

Documents are tagged for cross-cutting navigation. Browse by tag at [/internal/platform/design/tags](/internal/platform/design/tags).

| Tag                | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `cloud-relay`      | Cloud Relay component docs                                        |
| `aegis`            | Aegis Token Broker docs                                           |
| `openapi-indexer`  | OpenAPI indexing pipeline docs                                    |
| `multi-tenant`     | Multi-tenancy design and per-tenant isolation                     |
| `infrastructure`   | AWS infrastructure design, IaC patterns, and resource conventions |
| `tagging`          | AWS resource tagging standards                                    |
| `iac`              | Infrastructure as Code (CDK) patterns and constructs              |
| `authentication`   | Auth protocols — JWT, mTLS, HMAC, IAM                             |
| `security`         | Security model and trust boundaries                               |
| `networking`       | Network topology and delivery modes                               |
| `data-pipeline`    | Data ingestion, indexing, and search                              |
| `cli`              | slaops-cli tooling                                                |
| `component-design` | Component proposals and design specs                              |
| `architecture`     | System architecture and ADRs                                      |
| `implemented`      | Designs for features that have been built                         |
| `process`          | Team process and standards                                        |
