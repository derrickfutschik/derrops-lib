---
id: openapi-indexer-index
title: OpenAPI Indexer
sidebar_label: Overview
sidebar_position: 1
created_at: 2026-04-18
updated_at: 2026-04-18
implemented_at: ~
author: Derrick
status: draft
tags:
  - openapi-indexer
  - data-pipeline
  - component-design
  - oaspec
---

# OpenAPI Indexer

This section covers the design of the OASpec domain: how APIs and their OpenAPI specifications are stored, indexed, versioned, and searched across the SLAOps platform.

## Design Documents

| Document | Status | Description |
|---|---|---|
| [API & OASpec Data Model](./api-oaspec-data-model) | Draft | SQL entities for APIs and OASpec records; entity relationships; multi-tenancy |
| [OpenSearch Indices](./opensearch-indices) | Draft | Five dedicated indices (spec, server, operation, parameter, model); versioning strategy |
| [Spec Field Extraction](./spec-field-extraction) | Draft | How raw OpenAPI spec fields are parsed and transformed into the five index document types |
| [Extractor Pattern](./extractor-pattern) | Draft | Common `ISpecExtractor<TDoc>` pattern — shared context, extraction result, and per-entity `ExtractionState[]` returned by the indexer |
| [Indexing Pipeline](./indexing-pipeline) | Draft | Six-step sequential indexing flow; indexing stats; version lifecycle management |
| [Search Design](./search-design) | Draft | Operation, server, API, parameter, and model search; host-shape matching; enrichment lookup |
| [API Matching Algorithm](./api-matching) | Draft | Server resolution, base-path disambiguation, operation matching; host shape rules; AWS URL reference test cases |
| [UI Design](./ui-design) | Draft | APIs tab; upload wizard; version browser; diff view; operation explorer |
| [Version Strategies](./version-strategies) | Draft | Management modes (platform vs. private); platform catalogue; url_fetch strategy and future strategies |
| [New API Wizard](./new-api-wizard) | Draft | `/apis/new` wizard: Redux slice design, URL auto-populate via `GET /apis/info`, component tree |

### Legacy / Reference

- [OpenAPI Directory Indexer](./openapi-directory-indexer) — **Superseded.** Original single-index S3-triggered Lambda design. The implementation has since moved to NestJS.
- [OpenAPI Index Access Pattern](./openapi-index-access-pattern) — Two-tier multi-tenant access pattern. Still valid for understanding index scoping and alias strategy.

---

## Domain Overview

The OASpec domain separates **application data** (what APIs exist, which version is current) from **search and telemetry data** (indexed spec content, operations, servers, parameters, models).

```mermaid
graph TD
    subgraph SQL["PostgreSQL — Application Data"]
        APITbl["api\nOne row per API — identity + aggregate stats + latest ref"]
    end

    subgraph S3Store["S3 — Raw Spec Storage"]
        SpecBucket["{region}--{env}--slaops--{tenantId}--oaspec--storage--specs\nFull YAML/JSON spec files"]
    end

    subgraph OS["OpenSearch — Search & Telemetry"]
        SpecIdx["slaops--{tenantId}--oaspec--spec\nSpec metadata per version"]
        SvrIdx["slaops--{tenantId}--oaspec--server\nServer entries per version"]
        OpIdx["slaops--{tenantId}--oaspec--operation\nOperation entries per version"]
        ParamIdx["slaops--{tenantId}--oaspec--param\nParameter entries"]
        ModelIdx["slaops--{tenantId}--oaspec--model\nSchema models per version"]
    end

    subgraph Portal["Portal UI"]
        WizardUI[Upload Wizard]
        VersionBrowser[Version Browser]
        OpExplorer[Operation Explorer]
    end

    APITbl -->|latestOpensearchId| SpecIdx
    SpecIdx -->|apiId| SvrIdx
    SpecIdx -->|apiId| OpIdx
    SpecIdx -->|apiId| ParamIdx
    SpecIdx -->|apiId| ModelIdx
    SpecIdx -->|s3Bucket + s3Key| SpecBucket

    WizardUI -->|POST /api| APITbl
    WizardUI -->|upload spec| SpecBucket
    WizardUI -->|POST /openapi/index| SpecIdx
    OpExplorer -->|search| OpIdx

    style SQL fill:#4a9eff,stroke:#333,color:#fff
    style S3Store fill:#e879f9,stroke:#333,color:#fff
    style OS fill:#f59e0b,stroke:#333,color:#fff
    style Portal fill:#10b981,stroke:#333,color:#fff
```

### Key Principles

- **API first.** An API entity must exist in PostgreSQL before any OpenAPI spec can be indexed against it. An OASpec cannot exist without a parent API.
- **Three-tier storage.** Raw spec files (YAML/JSON) live in the [OASpec S3 bucket](/docs/oaspec-bucket). Indexed/searchable content lives in OpenSearch. Application state (API identity, version counts, stats) lives in PostgreSQL.
- **Multiple versions, one SQL row.** The `api` table holds one row per API — not one row per version. It tracks the latest version reference and aggregate counts.
- **Configurable version retention.** By default the last 2 versions are retained in OpenSearch. The `latest: true` flag is exclusive to one document per API in each index.
- **Tenant isolation.** Every SQL row carries `tenant_id`. Every OpenSearch document carries `tenantId`, and indices are scoped per tenant via aliases (see [OpenAPI Index Access Pattern](./openapi-index-access-pattern)).
