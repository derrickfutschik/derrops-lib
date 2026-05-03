---
id: parameters-tab
title: Parameters Tab Design
sidebar_label: Parameters Tab
sidebar_position: 5
created_at: 2026-04-19
updated_at: 2026-04-19
implemented_at: 2026-04-19
implements:
  - apps/derrops-portal/src/components/apis/ParametersTab.tsx
  - apps/derrops-portal/src/hooks/useParametersTab.ts
author: Derrick
status: implemented
tags:
  - openapi-indexer
  - component-design
  - data-pipeline
  - oaspec
  - portal
  - implemented
---

# Parameters Tab Design

The Parameters tab lists all parameter documents indexed for the selected API version from the `oaspec--param` index. Each row represents a deduplicated parameter — parameters shared across multiple operations appear once, with the `operationIdsText` field recording which operations use them.

## Purpose

- Browse and search all parameters defined across the spec.
- Identify required parameters, deprecated parameters, and their schema types.
- Filter by location (`path`, `query`, `header`, `cookie`) to focus on a specific parameter category.
- Support the Operation Detail panel's parameter list (fetched with an `operationId` filter).

---

## Backend — Controller Endpoint

### `GET /openapi/api/:apiId/parameters`

**Path param**: `apiId` — UUID of the API.

**Query params**:

| Param         | Default    | Notes                                                                                     |
| ------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `version`     | _(latest)_ | `latest` sentinel or a specific version string                                            |
| `from`        | `0`        | OpenSearch `from`                                                                         |
| `size`        | `10`       | OpenSearch `size`, max `100`                                                              |
| `sort`        | `name`     | Sortable fields: `name`, `location`, `schemaType`, `required`, `deprecated`               |
| `order`       | `asc`      | `asc` or `desc`                                                                           |
| `q`           | _(empty)_  | Full-text search across `name`, `description`                                             |
| `location`    | _(all)_    | Filter by parameter location: `path`, `query`, `header`, `cookie`                         |
| `operationId` | _(all)_    | Filter to parameters used by a specific operation ID (used by the Operation Detail panel) |

**OpenSearch query** (against `derrops--{tenantId}--oaspec--param`):

```json
{
  "query": {
    "bool": {
      "filter": [{ "term": { "apiId": "<apiId>" } }, { "term": { "latest": true } }],
      "must": [
        {
          "multi_match": {
            "query": "<q>",
            "fields": ["name", "description"],
            "type": "best_fields",
            "fuzziness": "AUTO"
          }
        }
      ]
    }
  },
  "sort": [{ "name": { "order": "asc" } }],
  "from": 0,
  "size": 10
}
```

When `location` is set, add `term: { location: "<location>" }` to `bool.filter`. When `operationId` is set, add `match: { operationIdsText: "<operationId>" }` to `bool.filter`. The `must` multi-match clause is omitted when `q` is empty.

**Response DTO**:

```typescript
interface ParametersPageResult {
  total: number
  from: number
  size: number
  version: string
  hits: ParameterHit[]
}

interface ParameterHit {
  id: string
  name: string
  location: string
  required: boolean
  deprecated: boolean
  description?: string
  schemaType?: string
  schemaFormat?: string
  exampleText?: string
  operationIdsText: string
}
```

---

## Frontend — Component Design

### Toolbar

1. **Search input** — free-text, debounced 300 ms, searches across `name` and `description`.
2. **Location filter** — pill group: `All | path | query | header | cookie`. Each pill uses `LocationBadge` colours matching the existing implementation.
3. **Version badge** — read-only.

### Column layout

| Column          | Field                         | Sortable | Hideable | Notes                                                                                 |
| --------------- | ----------------------------- | -------- | -------- | ------------------------------------------------------------------------------------- |
| **Name**        | `name`                        | Yes      | No       | Monospace; always visible                                                             |
| **Location**    | `location`                    | Yes      | No       | `LocationBadge` — `path` (blue), `query` (grey), `header` (purple), `cookie` (orange) |
| **Type**        | `schemaType` + `schemaFormat` | Yes      | No       | `schemaType schemaFormat` monospace, e.g. `string date-time`                          |
| **Required**    | `required`                    | Yes      | Yes      | `✓` when true                                                                         |
| **Deprecated**  | `deprecated`                  | Yes      | Yes      | Amber `⚠` icon; hidden by default (inline in Name when deprecated)                   |
| **Description** | `description`                 | No       | Yes      | Truncated to one line; deprecated `⚠` prepended when `deprecated: true`              |
| **Example**     | `exampleText`                 | No       | Yes      | Hidden by default                                                                     |
| **Used by**     | `operationIdsText`            | No       | Yes      | Comma count of operation IDs (e.g. "3 operations"); hover shows list                  |

### IndexedDataTable conventions

All column headers follow the [IndexedDataTable convention](./index.md#indexeddatatable-convention):

- Sorting sends `sort` + `order` to the server.
- EyeOff hides a column client-side.
- Status bar at the bottom: `{filtered}/{total} parameters` when a search or location filter is active, otherwise `{total} parameters`.

### Pagination

Standard `< Prev | Page N of M | Next >` bar beneath the status bar.

### Redux state

```typescript
interface ParametersTabState {
  query: string
  locationFilter: string | null
  sort: { field: string; direction: 'asc' | 'desc' }
  hiddenColumns: Set<string>
  page: number
}
```

Slice: `parametersTabSlice` in `src/store/`. The existing `apisSlice.paramsQuery` should be migrated here.

---

## Key Decisions

**`operationIdsText` as a count, not a list.** Showing the full list of operation IDs per row would overflow the column. The "Used by N operations" summary is sufficient in the table; the full list is accessible on hover (tooltip) or in a future detail panel.

**Deprecation inline in Description.** Matching the pattern from `OperationsTab` — the deprecated badge is prepended to the Description column content rather than surfaced as a standalone boolean column. The standalone `Deprecated` column exists for sort access but is hidden by default.

**Location filter as pill group, not dropdown.** There are exactly four valid locations — a pill group is faster to interact with than a dropdown for a fixed small set.

**Server-side search.** Specs with many shared parameters (e.g. a pagination parameter used by every list operation) can produce hundreds of deduplicated parameter documents. Client-side filtering from a pre-loaded array would be slow for large specs.

---

## Related Documents

- [OpenSearch Indices](../opensearch-indices) — `OaParamDocument` schema
- [Operations Tab](./operations-tab) — links to this tab from the Operation Detail panel
- [Spec Field Extraction](../spec-field-extraction) — how parameters are deduplicated and extracted
