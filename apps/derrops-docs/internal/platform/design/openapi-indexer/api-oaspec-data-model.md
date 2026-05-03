---
id: api-oaspec-data-model
title: API Data Model
sidebar_label: Data Model
sidebar_position: 2
created_at: 2026-04-18
updated_at: 2026-04-18
implemented_at: ~
author: Derrick
status: draft
tags:
  - openapi-indexer
  - data-pipeline
  - component-design
  - multi-tenant
  - architecture
  - oaspec
---

# API Data Model

This document defines the PostgreSQL data model for the OASpec domain — the `api` table, its spec-tracking columns, and the distinction between what lives in SQL versus OpenSearch.

## Design Principles

- **Application data in SQL.** API identity, ownership, version tracking, and aggregate stats are authoritative in PostgreSQL. This data drives CRUD flows in the portal.
- **Search and telemetry in OpenSearch.** Full spec content, indexed operations, servers, parameters, and models live in OpenSearch. See [OpenSearch Indices](./opensearch-indices).
- **Raw spec in S3, indexed content in OpenSearch.** The full YAML/JSON spec file is stored permanently in the tenant's [OASpec S3 bucket](/docs/oaspec-bucket). OpenSearch stores only the parsed, indexed fields plus a reference (`s3Bucket`, `s3Key`) back to S3. SQL stores only stats and the latest OpenSearch document ID.
- **No global rows in RDS.** The platform catalogue (`t-glbl0000`) lives exclusively in OpenSearch. Tenant `api` rows are created only when a tenant explicitly adopts or creates an API. The global index is queried directly from the wizard — no SQL round-trip.
- **One row per API.** The `api` table does not store one row per version. It stores one row per API, carrying the latest version reference and aggregate stats. Version history is in OpenSearch.
- **API must exist before OASpec.** An OASpec cannot be indexed without a parent API row. The wizard enforces this.
- **Future spec types.** The design reserves `spec_type` for future non-OpenAPI formats (GraphQL, gRPC, SOAP). For now only `openapi` is supported.

---

## Domain Objects

Three distinct domain objects are modelled here, all stored in the single `api` PostgreSQL table as embedded value types (no JOINs). Each has a clearly bounded responsibility:

| Domain object       | Responsibility                                                           | Owned by                               |
| ------------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| `Api`               | Identity — name, tenant, management mode                                 | Always present                         |
| `OaSpecRef`         | Current spec state — latest version reference and cached aggregate stats | Populated after first index run        |
| `VersionFetchState` | Version delivery — strategy config and last fetch outcome                | Only when `management_mode: 'private'` |

Treating them as separate domain objects keeps business logic for spec-tracking and fetch-scheduling out of the core API entity while avoiding the cost of additional tables or JOINs. See the [NestJS Domain Objects](#nestjs-domain-objects) section for the class structure.

---

## API vs OASpec

An **API** and an **OASpec** are distinct concepts:

- An **API** is the stable identity of an HTTP service — a named product owned by a tenant. It exists independently of whether any spec has been indexed. A tenant creates an API first, then attaches spec versions to it. The API record persists even if all spec versions are removed.

- An **OASpec** (OpenAPI Specification) is the versioned technical description of an API — its operations, servers, parameters, and models. In this platform, OASpec data has two representations:
  - **In OpenSearch** — the full indexed content, split across five indices (`spec`, `server`, `operation`, `param`, `model`). This is the canonical source of spec content and version history.
  - **In `OaSpecRef`** — a lightweight embedded record on the `Api` domain object carrying the latest version reference and pre-computed aggregate stats. This exists as a read optimisation so the portal list view never needs to query OpenSearch.

The relationship: one `Api` has at most one `OaSpecRef` (the current state), which points into OpenSearch where the full content and all retained versions live.

```
Api (PostgreSQL)
 └── OaSpecRef (embedded) → latest_opensearch_id
                            ↓
                        derrops--{tenantId}--oaspec--spec  (OpenSearch — all versions)
                        derrops--{tenantId}--oaspec--operation
                        derrops--{tenantId}--oaspec--server
                        ...
```

---

## SQL Table: `api`

One PostgreSQL table stores all three domain objects. Columns are annotated with their logical owner.

**`Api` identity columns:**

| Column            | Type           | Constraints                     | Description                                                                  |
| ----------------- | -------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| `id`              | `uuid`         | PK, default `gen_random_uuid()` | Unique identifier                                                            |
| `tenant_id`       | `varchar(10)`  | NOT NULL                        | Owning tenant — format `t-<8 alphanum>`, e.g. `t-acme0001`                   |
| `name`            | `varchar(255)` | NOT NULL                        | Human-readable API name (e.g. "Stripe Payments API")                         |
| `description`     | `text`         | nullable                        | Short description of what the API does                                       |
| `external_url`    | `varchar(500)` | nullable                        | Official docs or homepage URL                                                |
| `spec_type`       | `varchar(50)`  | NOT NULL, default `'openapi'`   | Spec format — `openapi` only for now; reserved for `graphql`, `grpc`, `soap` |
| `management_mode` | `varchar(20)`  | NOT NULL, default `'private'`   | `'platform'` — platform manages versions; `'private'` — tenant manages       |
| `created_at`      | `timestamp`    | NOT NULL, default `now()`       | Row creation time                                                            |
| `updated_at`      | `timestamp`    | NOT NULL, auto-updated          | Last modification time                                                       |

**`OaSpecRef` embedded columns** (populated after first index run; null until then):

| Column                      | Type           | Constraints           | Description                                                        |
| --------------------------- | -------------- | --------------------- | ------------------------------------------------------------------ |
| `spec_global_opensearch_id` | `varchar(500)` | nullable              | Platform mode: doc ID in `derrops--t-glbl0000--oaspec--spec`        |
| `spec_latest_version`       | `varchar(100)` | nullable              | Version string of the latest indexed spec (e.g. `"2.1.0"`)         |
| `spec_latest_opensearch_id` | `varchar(500)` | nullable              | Doc ID in the tenant's or global spec index for the latest version |
| `spec_operation_count`      | `integer`      | NOT NULL, default `0` | Total operations in the latest version                             |
| `spec_server_count`         | `integer`      | NOT NULL, default `0` | Total servers in the latest version                                |
| `spec_parameter_count`      | `integer`      | NOT NULL, default `0` | Total parameters in the latest version                             |
| `spec_model_count`          | `integer`      | NOT NULL, default `0` | Total models/schemas in the latest version                         |
| `spec_last_indexed_at`      | `timestamp`    | nullable              | When the latest version was indexed                                |

**`VersionFetchState` embedded columns** (null when `management_mode: 'platform'`):

| Column              | Type           | Constraints | Description                                                                     |
| ------------------- | -------------- | ----------- | ------------------------------------------------------------------------------- |
| `fetch_strategy`    | `varchar(50)`  | nullable    | `'manual'` \| `'url_fetch'` \| … See [Version Strategies](./version-strategies) |
| `fetch_url`         | `varchar(500)` | nullable    | URL to GET the spec from (`url_fetch` strategy)                                 |
| `fetch_cron`        | `varchar(100)` | nullable    | Cron schedule (UTC), e.g. `0 2 * * *`                                           |
| `fetch_last_at`     | `timestamp`    | nullable    | When the last fetch was attempted                                               |
| `fetch_last_status` | `varchar(20)`  | nullable    | `'ok'` \| `'error'`                                                             |
| `fetch_last_error`  | `text`         | nullable    | Error message from the last failed fetch                                        |

**Index:** `(tenant_id, name)` — used by the wizard's fuzzy-name lookup.

**Note on the existing `service` table.** The current codebase has a `service` entity that mixes API metadata with per-user ownership (`user_id`), performance metrics, and raw spec content. The `api` table replaces the spec-hosting part of `service`. Performance metrics are telemetry and belong in OpenSearch.

---

## Management Mode & Version Strategy

Every `api` row has a `management_mode` that controls who delivers spec versions, and (for private mode) a `version_strategy` that controls how.

| `management_mode` | Spec source                                     | `version_strategy` applies? |
| ----------------- | ----------------------------------------------- | --------------------------- |
| `platform`        | Global index (`t-glbl0000`) — managed by Derrops | No                          |
| `private`         | Tenant's private index — tenant is responsible  | Yes                         |

A tenant adopts a platform-managed API by selecting it from the catalogue in the wizard. This creates an `api` row with `management_mode: 'platform'` and `oaSpec.globalOpensearchId` (`spec_global_opensearch_id` in SQL) pointing at the global spec document. No private index is provisioned; aggregate stats are refreshed nightly from the global index.

A private API uses `version_strategy` to determine the delivery mechanism — `'manual'` (wizard upload) or `'url_fetch'` (scheduled fetch from a URL). See [Version Strategies](./version-strategies) for the full strategy reference including future strategies (`github_sync`, `webhook`, etc.) and the fetch error/backoff model.

**No global rows in RDS.** The platform catalogue is OpenSearch-only. `api` rows are created only when a tenant explicitly adopts or creates an API. The wizard queries `GET /openapi/catalogue?q=...` directly against the global index — no SQL involved.

---

## ID Generation Strategy

All OpenSearch document IDs are **deterministic** — derived from the tenant and the fields that semantically identify the entity. This means:

- Re-indexing the same spec version produces the same IDs → OpenSearch `index` calls become upserts, never duplicates.
- IDs are calculable at any point in the pipeline without a database lookup.
- Collision = intentional overwrite; there is no separate deduplication pass.

### Hash function

All IDs use the format:

```
{tenant_id}-{SHA256_16(fields)}
```

`SHA256_16` = first 16 hex characters of the SHA-256 digest of the concatenated field values (joined with `|` as a separator). 16 hex chars = 64 bits of entropy, sufficient to avoid accidental collision across any realistic tenant corpus.

```typescript
function oaspecId(tenantId: string, ...fields: string[]): string {
  const digest = createHash('sha256').update(fields.join('|')).digest('hex')
  return `${tenantId}-${digest.slice(0, 16)}`
}
```

### ID formulas per entity

| Index               | Fields hashed                                    | Example                       |
| ------------------- | ------------------------------------------------ | ----------------------------- |
| `oaspec--spec`      | `info.title`, `info.version`                     | `t-acme0001-a3f9b21c04e87d56` |
| `oaspec--server`    | `info.title`, `info.version`, `server.url`       | `t-acme0001-8d4e1a7b93c25f0e` |
| `oaspec--operation` | `info.title`, `info.version`, `method`, `path`   | `t-acme0001-1c7f4d8e2a905b3a` |
| `oaspec--param`     | `info.title`, `info.version`, `name`, `location` | `t-acme0001-6b2e9c4f17a083d5` |
| `oaspec--model`     | `info.title`, `info.version`, `modelName`        | `t-acme0001-d09f3b85e6741c2a` |

`info.title` and `info.version` anchor every entity to its spec version. `location` is included in param IDs because the same parameter name can legitimately appear in different locations (e.g. a `id` path parameter and a `id` query parameter are distinct).

### PostgreSQL `api.id`

The `api` table uses a standard `gen_random_uuid()` primary key. SQL identity does not need to be content-addressable — the FK is a stable internal reference, not recomputed from content. Only OpenSearch document IDs use the hash scheme.

---

## API-First Constraint

The wizard and API enforce this ordering:

```
1. Ensure api row exists (create or select)
2. Begin indexing pipeline → writes to OpenSearch
3. Update api row with latest version stats (last step of pipeline)
```

If step 2 fails, the `api` row's spec-tracking columns are not updated and the SQL state remains consistent with the previous version. There is no partial state where a spec is partially indexed.

---

## Multi-Tenancy

Every row in `api` carries `tenant_id`. Row-level isolation is enforced at the application layer: all queries include `WHERE tenant_id = :tenantId`. There are no shared rows between tenants.

The Derrops-managed public catalogue uses the reserved global tenant `t-glbl0000` — the same `varchar(10)` format as all tenant IDs. See [OpenAPI Index Access Pattern](./openapi-index-access-pattern) for how this maps to OpenSearch index scoping.

---

## Raw Spec Storage

The full spec file (YAML or JSON) is stored permanently in the tenant's dedicated OASpec S3 bucket. See [OASpec Bucket](/docs/oaspec-bucket) for bucket naming conventions.

| Tenancy          | Bucket name pattern                                           | Example                                                       |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| Tenant-private   | `{region}--{env}--derrops--{tenantId}--oaspec--storage--specs` | `us-east-1--prod--derrops--t-acme0001--oaspec--storage--specs` |
| Platform-managed | `{region}--{env}--derrops--t-glbl0000--oaspec--storage--specs` | `us-east-1--prod--derrops--t-glbl0000--oaspec--storage--specs` |

**Object key convention:** `APIs/{provider}/{service}/{version}/openapi.yaml`

When a tenant uploads a spec via the portal, the pre-signed URL from `POST /openapi/upload-url` targets their OASpec bucket directly — there is no staging bucket. The `bucket` and `key` passed to `POST /openapi/index` therefore reference the permanent storage location, and those values are written into the `OaSpecDocument` (`s3Bucket`, `s3Key`) so any component can later fetch the raw file without going back through the API.

The portal's Spec Viewer tab fetches the raw YAML/JSON directly from S3 using a short-lived pre-signed read URL, not from OpenSearch.

---

## NestJS Domain Objects

Three classes represent the three domain objects. `OaSpecRef` and `VersionFetchState` are embedded value types — their columns live on the `api` table with a column prefix (TypeORM `@Column(() => ...)` embedded syntax), so no JOINs are ever needed.

```typescript
// Value object — current spec state and cached aggregate stats.
// Populated after the first index run; null fields until then.
export class OaSpecRef {
  @Column({ name: 'spec_global_opensearch_id', type: 'varchar', length: 500, nullable: true })
  globalOpensearchId: string | null

  @Column({ name: 'spec_latest_version', type: 'varchar', length: 100, nullable: true })
  latestVersion: string | null

  @Column({ name: 'spec_latest_opensearch_id', type: 'varchar', length: 500, nullable: true })
  latestOpensearchId: string | null

  @Column({ name: 'spec_operation_count', type: 'integer', default: 0 })
  operationCount: number

  @Column({ name: 'spec_server_count', type: 'integer', default: 0 })
  serverCount: number

  @Column({ name: 'spec_parameter_count', type: 'integer', default: 0 })
  parameterCount: number

  @Column({ name: 'spec_model_count', type: 'integer', default: 0 })
  modelCount: number

  @Column({ name: 'spec_last_indexed_at', type: 'timestamp', nullable: true })
  lastIndexedAt: Date | null
}

// Value object — version delivery configuration and last fetch outcome.
// Null/empty for platform-managed APIs.
export class VersionFetchState {
  @Column({ name: 'fetch_strategy', type: 'varchar', length: 50, nullable: true })
  strategy: string | null // 'manual' | 'url_fetch' | ...

  @Column({ name: 'fetch_url', type: 'varchar', length: 500, nullable: true })
  url: string | null

  @Column({ name: 'fetch_cron', type: 'varchar', length: 100, nullable: true })
  cron: string | null

  @Column({ name: 'fetch_last_at', type: 'timestamp', nullable: true })
  lastAt: Date | null

  @Column({ name: 'fetch_last_status', type: 'varchar', length: 20, nullable: true })
  lastStatus: string | null // 'ok' | 'error'

  @Column({ name: 'fetch_last_error', type: 'text', nullable: true })
  lastError: string | null
}

// Root entity — all three objects stored in the single `api` table.
@Entity('api')
export class ApiEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 10 })
  tenantId: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  externalUrl: string | null

  @Column({ type: 'varchar', length: 50, default: 'openapi' })
  specType: string

  @Column({ type: 'varchar', length: 20, default: 'private' })
  managementMode: string // 'platform' | 'private'

  // Embedded — columns live on this table, no JOIN needed
  @Column(() => OaSpecRef)
  oaSpec: OaSpecRef

  @Column(() => VersionFetchState)
  fetchState: VersionFetchState

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

---

## REST API Endpoints

The `api` module exposes standard CRUD backed by PostgreSQL:

| Method   | Path                    | Description                                                      |
| -------- | ----------------------- | ---------------------------------------------------------------- |
| `GET`    | `/api`                  | List APIs for the current tenant                                 |
| `POST`   | `/api`                  | Create a new private API                                         |
| `POST`   | `/api/adopt`            | Adopt a platform-managed API from the catalogue                  |
| `GET`    | `/api/:id`              | Get an API with its latest spec stats                            |
| `PATCH`  | `/api/:id`              | Update name/description/external_url/version_strategy            |
| `DELETE` | `/api/:id`              | Delete API row (OpenSearch cleanup is async)                     |
| `GET`    | `/api/search?q=`        | Fuzzy name search across tenant's own APIs                       |
| `GET`    | `/openapi/catalogue?q=` | Search the platform catalogue (global OpenSearch index — no SQL) |
| `POST`   | `/api/:id/fetch`        | Manually trigger a url_fetch strategy re-fetch                   |

The indexing pipeline (which writes to OpenSearch and updates the `api` row) is triggered separately via `POST /openapi/index`. See [Indexing Pipeline](./indexing-pipeline).

---

## Related Documents

- [OASpec Bucket](/docs/oaspec-bucket) — public docs on bucket naming and tenant isolation
- [Version Strategies](./version-strategies) — management modes, platform catalogue, url_fetch, and future strategies
- [OpenSearch Indices](./opensearch-indices) — where spec content, operations, servers, parameters, and models are stored
- [Indexing Pipeline](./indexing-pipeline) — how the `api` row is updated as step 6 of the pipeline
- [UI Design](./ui-design) — wizard flow including catalogue search and version strategy configuration
- [OpenAPI Index Access Pattern](./openapi-index-access-pattern) — tenant-scoped index and alias strategy
