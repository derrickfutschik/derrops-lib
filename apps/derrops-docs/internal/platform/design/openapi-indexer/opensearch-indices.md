---
id: opensearch-indices
title: OpenSearch Indices
sidebar_label: OpenSearch Indices
sidebar_position: 3
created_at: 2026-04-18
updated_at: 2026-04-18
implemented_at: ~
author: Derrick
status: draft
tags:
  - openapi-indexer
  - data-pipeline
  - architecture
  - multi-tenant
  - oaspec
---

# OpenSearch Indices

This document defines the five OpenSearch indices used by the OASpec domain, the document schemas for each, and the versioning strategy that governs how multiple versions of a spec coexist in each index.

## Why Five Separate Indices

The original design used a single `openapi-specs` index with aggregated stats and sample operations. The revision separates the data into five dedicated indices because each entity type has distinct query patterns, field requirements, and update cadences:

| Index (entity segment) | Primary Query Pattern                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| `…--oaspec--spec`      | Search by title/description; get spec metadata; version listing                  |
| `…--oaspec--server`    | Match incoming request host to a known server; find servers for an API           |
| `…--oaspec--operation` | Semantic search across all operations by summary/description; method+path lookup |
| `…--oaspec--param`     | Find parameters by name, type, or description across all APIs                    |
| `…--oaspec--model`     | Look up schemas/models by name; find all models for a spec                       |

Keeping them separate also allows independent mapping configuration, index-level IAM policies if needed, and targeted reindexing of a single entity type without touching others.

---

## Index Naming

Following the [Derrops naming conventions](/blog/derrops-naming-sheet), OpenSearch indices use the flat-kebab silo pattern with `--` as segment separators:

```
derrops--{tenantId}--oaspec--{entity}
```

| Index                                    | Example (tenant: `t-acme0001`)           |
| ---------------------------------------- | ---------------------------------------- |
| `derrops--{tenantId}--oaspec--spec`      | `derrops--t-acme0001--oaspec--spec`      |
| `derrops--{tenantId}--oaspec--server`    | `derrops--t-acme0001--oaspec--server`    |
| `derrops--{tenantId}--oaspec--operation` | `derrops--t-acme0001--oaspec--operation` |
| `derrops--{tenantId}--oaspec--param`     | `derrops--t-acme0001--oaspec--param`     |
| `derrops--{tenantId}--oaspec--model`     | `derrops--t-acme0001--oaspec--model`     |

The Derrops-managed public catalogue uses the reserved global tenant `t-glbl0000` (e.g. `derrops--t-glbl0000--oaspec--spec`).

---

## Versioning Strategy

### The `latest` Flag

Every document in every index carries a `latest: boolean` field. At any point in time, **exactly one document per `apiId` per index** has `latest: true`.

When a new version is indexed:

1. The single document with `apiId = <apiId> AND latest = true` is updated to `latest: false`. (Exactly one such document exists, or none for the first version — targeting only this document avoids touching all retained historical versions.)
2. The new documents are written with `latest: true`.

This update happens as the first write step for each index type in the pipeline. See [Indexing Pipeline](./indexing-pipeline) for the full sequence.

**Enrichment** (matching incoming requests to OpenAPI operations at log ingestion time) queries **only** documents where `latest: true`. This limits enrichment to the current version and keeps lookup fast.

### Version Retention

By default, the last **2 versions** of each API are retained in each index. Older versions are deleted during the indexing pipeline run. The retention count is configurable per tenant via `config['opensearch.oaspec.version-retention']` (default: `2`).

The `latest: false` documents for the retained window remain searchable — users browsing version history in the portal can still query old versions. Only versions outside the retention window are physically deleted.

```
Versions in index after indexing v3 (retention = 2):
  v1 → deleted
  v2 → latest: false (retained)
  v3 → latest: true  (retained, current)
```

---

## 1. Spec Index (`derrops--{tenantId}--oaspec--spec`)

Stores one document per spec version — the top-level metadata extracted from the OpenAPI `info` object.

```typescript
interface OaSpecDocument {
  // Identity
  id: string // "{tenantId}-{SHA256_16(title, version)}" — see API Data Model: ID Generation
  apiId: string // FK → api.id in PostgreSQL
  tenantId: string
  version: string // from info.version
  specVersion: string // openapi field value, e.g. "3.1.0"

  // Versioning
  latest: boolean
  indexedAt: string // ISO timestamp
  updatedAt: string

  // Metadata
  title: string
  description: string
  termsOfService?: string
  contactText?: string // "Name <email> url" — flat text, e.g. "Stripe Support support@stripe.com https://stripe.com"
  licenseText?: string // "MIT https://opensource.org/licenses/MIT"
  externalDocsText?: string // "description url"
  tagsText: string // space-separated tags — e.g. "payments billing invoices webhooks"

  // Aggregate counts (mirrors api SQL row — redundant but avoids SQL round-trip)
  operationCount: number
  serverCount: number
  parameterCount: number
  modelCount: number

  // S3 storage reference — permanent location in the OASpec bucket (see /docs/oaspec-bucket)
  // Used to serve the raw spec file (pre-signed read URL) without a pipeline round-trip
  s3Bucket: string // e.g. "us-east-1--prod--derrops--t-acme0001--oaspec--storage--specs"
  s3Key: string // e.g. "APIs/stripe.com/payments/2024-01/openapi.yaml"
  fileSize: number
  fileFormat: string // "yaml" | "json"
}
```

**No arrays.** `tagsText` is a space-separated string — full-text search still finds specs by tag without keyword array indexing. Aggregate counts support tabular display without querying nested docs.

**OpenSearch mapping highlights:**

- `title`, `description`, `tagsText`: `text` with `standard` analyzer
- `title` also has a `.keyword` sub-field for sorting
- `latest`: `boolean` — always included in enrichment filters
- `apiId`, `tenantId`, `version`, `fileFormat`: `keyword`

---

## 2. Server Index (`derrops--{tenantId}--oaspec--server`)

Each server entry from the spec's `servers` array becomes a separate document. One spec version with 3 servers produces 3 server documents.

```typescript
interface OaServerDocument {
  // Identity
  id: string // "{tenantId}-{SHA256_16(title, version, server.url)}"
  apiId: string
  specId: string // FK to spec document — see API Data Model: ID Generation
  tenantId: string
  version: string
  serverIndex: number // position in the servers array

  // Versioning
  latest: boolean
  indexedAt: string

  // Server fields
  rawUrl: string // e.g. "https://cloudtrail.{region}.amazonaws.com"
  description?: string

  // Parsed for matching (see Search Design)
  scheme: string // "https" | "http"
  hostTemplate: string // "cloudtrail.{region}.amazonaws.com"
  hostShape: string // "cloudtrail.*.amazonaws.com" (vars replaced with *)
  dnsSuffix: string // "amazonaws.com"
  fixedLabelsText: string // space-separated fixed labels — "cloudtrail"
  varLabelsText: string // space-separated variable names — "region"
  basePath: string // server URL path component, e.g. "/v1" or "/"

  // Variables flattened to searchable text — "region:us-east-1 stage:prod"
  variablesText?: string
}
```

**No arrays.** `fixedLabelsText` and `varLabelsText` are space-separated strings. `variablesText` serialises each variable as `name:default` joined by spaces, keeping the index flat.

**Key fields for request matching:**

- `hostShape` is the primary lookup key for enrichment. See [Search Design](./search-design).
- `basePath` disambiguates multiple APIs on the same server domain.

**OpenSearch mapping highlights:**

- `hostShape`, `basePath`, `dnsSuffix`: `keyword` for exact and wildcard matching
- `rawUrl`, `description`, `variablesText`: `text`
- `fixedLabelsText`, `varLabelsText`: `text` (search only — not used for filtering)

---

## 3. Operation Index (`derrops--{tenantId}--oaspec--operation`)

Each HTTP operation in the spec (combination of HTTP method + path) becomes a separate document. A spec with 200 operations produces 200 operation documents.

```typescript
interface OaOperationDocument {
  // Identity
  id: string // "{tenantId}-{SHA256_16(title, version, method, path)}"
  apiId: string
  specId: string // FK to spec document
  tenantId: string
  version: string
  serverIndex?: number // if this operation is server-specific

  // Versioning
  latest: boolean
  indexedAt: string

  // Operation fields
  method: string // "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"
  path: string // "/users/{userId}/orders"
  operationId?: string
  summary?: string
  description?: string
  tagsText: string // space-separated tags — "payments billing"
  deprecated: boolean

  // Compact path key for fast matching (see Search Design)
  // Format: "{M}:{compacted_path}" e.g. "G:{i}/orders" for GET /{userId}/orders
  pathKey: string

  // Referenced IDs flattened to space-separated text for cross-lookup
  parameterIdsText: string // "param-uuid-1 param-uuid-2"
  requestModelId?: string // scalar — single request body model
  responseModelIdsText: string // "model-uuid-1 model-uuid-2"
}
```

**No arrays.** `tagsText`, `parameterIdsText`, and `responseModelIdsText` are space-separated strings. This keeps the index flat while preserving searchability — a query for a specific parameter or model ID still matches via a `match` query against the text field.

**`pathKey`.** The compacted path key supports efficient operation matching during enrichment. See [Search Design — Operation Matching](./search-design#operation-matching).

**OpenSearch mapping highlights:**

- `summary`, `description`, `tagsText`, `parameterIdsText`, `responseModelIdsText`: `text`
- `method`, `path`, `operationId`, `specId`, `apiId`: `keyword`
- `latest`, `deprecated`: `boolean`

---

## 4. Parameter Index (`derrops--{tenantId}--oaspec--param`)

Each parameter defined in the spec (at the operation or path level) becomes a document. Shared parameters defined at the `components.parameters` level are also indexed once; references from operations carry the parameter's `id`.

```typescript
interface OaParamDocument {
  // Identity
  id: string // "{tenantId}-{SHA256_16(title, version, name, location)}"
  apiId: string
  specId: string
  tenantId: string
  version: string

  // Versioning
  latest: boolean
  indexedAt: string

  // Parameter fields
  name: string
  location: string // "path" | "query" | "header" | "cookie"  (renamed from `in` — reserved word)
  required: boolean
  deprecated: boolean
  description?: string
  schemaType?: string // JSON Schema type: "string", "integer", "boolean", "array", "object"
  schemaFormat?: string // e.g. "uuid", "date-time", "uri"
  exampleText?: string // string representation of the example value

  // Operations that reference this parameter — space-separated IDs for text lookup
  operationIdsText: string
}
```

**No arrays.** `operationIdsText` is a space-separated string of operation IDs. A `match` query finds all parameters used by a given operation. `example` is serialised to `exampleText` (JSON string) rather than stored as an untyped value.

**OpenSearch mapping highlights:**

- `name`, `location`, `schemaType`, `schemaFormat`: `keyword`
- `description`, `exampleText`, `operationIdsText`: `text`

---

## 5. Model Index (`derrops--{tenantId}--oaspec--model`)

Each schema in `components.schemas` (and inline request/response bodies) becomes a model document.

```typescript
interface OaModelDocument {
  // Identity
  id: string // "{tenantId}-{SHA256_16(title, version, modelName)}"
  apiId: string
  specId: string
  tenantId: string
  version: string

  // Versioning
  latest: boolean
  indexedAt: string

  // Model fields
  name: string
  description?: string
  schemaType: string // "object" | "array" | "string" | "integer" etc.

  // All properties serialised as a single searchable text block.
  // Format per property: "{name} {type} {format?} - {description?}"
  // Lines joined with "\n", e.g.:
  //   "id string uuid - Unique identifier\nname string - Full display name\namount number - Payment total"
  propertiesText: string

  // Operations that reference this model — space-separated IDs
  operationIdsText: string

  // "request", "response", or "request response" — space-separated for text match
  usedInText: string
}
```

**No arrays.** `propertiesText` concatenates every property's name, type, format, and description into a single text field. A search for `"uuid"` or `"payment total"` still finds the model via full-text match without any nested or array mapping. `operationIdsText` and `usedInText` follow the same pattern.

**Properties text format:**

```
{name} {type} {format?} - {description?}
```

Example for a `Payment` model:

```
id string uuid - Unique payment identifier
amount number - Total payment amount in minor units
currency string - ISO 4217 currency code
status string - pending completed failed
created_at string date-time - Timestamp of payment creation
```

**OpenSearch mapping highlights:**

- `name`, `schemaType`: `keyword`
- `description`, `propertiesText`, `operationIdsText`, `usedInText`: `text` with `standard` analyzer

---

## Configuration

```typescript
/** Number of spec versions to retain in OpenSearch per API (default 2) */
'opensearch.oaspec.version-retention': 2,

/** Reserved global tenant ID for the Derrops-managed public catalogue */
'opensearch.oaspec.global-tenant-id': 't-glbl0000',
```

Index names are always constructed as:

```typescript
// derrops--{tenantId}--oaspec--{entity}
function oaspecIndex(
  tenantId: string,
  entity: 'spec' | 'server' | 'operation' | 'param' | 'model',
): string {
  return `derrops--${tenantId}--oaspec--${entity}`
}

// alias: derrops--{tenantId}--oaspec--spec--search
function oaspecAlias(tenantId: string): string {
  return `derrops--${tenantId}--oaspec--spec--search`
}
```

---

## Related Documents

- [API Data Model](./api-oaspec-data-model) — SQL `api` table and ID generation strategy for all OpenSearch documents
- [Indexing Pipeline](./indexing-pipeline) — how documents are written across all five indices
- [Search Design](./search-design) — query patterns for each index
- [OpenAPI Index Access Pattern](./openapi-index-access-pattern) — tenant alias strategy and two-tier managed/private catalogue
