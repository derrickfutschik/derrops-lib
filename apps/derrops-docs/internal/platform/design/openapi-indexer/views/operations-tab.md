---
id: operations-tab
title: Operations Tab Design
sidebar_label: Operations Tab
sidebar_position: 3
created_at: 2026-04-19
updated_at: 2026-04-19
implemented_at: 2026-04-19
implements:
  - apps/derrops-portal/src/components/apis/OperationsTab.tsx
  - apps/derrops-portal/src/hooks/useOperationsTab.ts
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

# Operations Tab Design

The Operations tab lists all HTTP operations indexed for the selected API version. It is the primary exploration surface for discovering what an API can do — method, path, summary, tags, and deprecation status at a glance, with a drill-in panel for full detail.

## Purpose

- Browse all operations for the latest (or selected) spec version.
- Search operations by keyword across path, summary, and method.
- Filter by HTTP method and by tag.
- Open an operation's detail panel to view parameters, request/response models, and a "Try in API Tester" shortcut.

---

## Backend — Controller Endpoint

### `GET /openapi/api/:apiId/operations`

**Path param**: `apiId` — UUID of the API.

**Query params**:

| Param     | Default    | Notes                                                                                                  |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `version` | _(latest)_ | `latest` sentinel or a specific version string. When `latest`, the query uses `term: { latest: true }` |
| `from`    | `0`        | OpenSearch `from`                                                                                      |
| `size`    | `10`       | OpenSearch `size`, max `100`                                                                           |
| `sort`    | `path`     | Sortable fields: `path`, `method`, `operationId`, `summary`                                            |
| `order`   | `asc`      | `asc` or `desc`                                                                                        |
| `q`       | _(empty)_  | Full-text search across `path`, `summary`, `tagsText`, `operationId`                                   |
| `method`  | _(all)_    | Comma-separated HTTP method filter: `get,post,put`                                                     |
| `tag`     | _(all)_    | Tag name filter (matches against `tagsText`)                                                           |

**OpenSearch query** (against `derrops--{tenantId}--oaspec--operation`):

```json
{
  "query": {
    "bool": {
      "filter": [{ "term": { "apiId": "<apiId>" } }, { "term": { "latest": true } }],
      "must": [
        {
          "multi_match": {
            "query": "<q>",
            "fields": ["path", "summary", "tagsText", "operationId"],
            "type": "best_fields",
            "fuzziness": "AUTO"
          }
        }
      ]
    }
  },
  "sort": [{ "path": { "order": "asc" } }, { "method": { "order": "asc" } }],
  "from": 0,
  "size": 10
}
```

When `q` is empty, the `must` clause is omitted. When `method` filter is present, an additional `terms: { method: [...] }` filter is added to the `bool.filter` array. When `version` is a specific string (not `latest`), `term: { version: "<version>" }` replaces `term: { latest: true }`.

**Response DTO**:

```typescript
interface OperationsPageResult {
  total: number
  from: number
  size: number
  version: string
  hits: OperationHit[]
}

interface OperationHit {
  id: string
  method: string
  path: string
  operationId?: string
  summary?: string
  description?: string
  tagsText: string
  deprecated: boolean
  pathKey: string
  parameterIdsText: string
  requestModelId?: string
  responseModelIdsText: string
}
```

---

## Frontend — Component Design

### Toolbar

Above the table:

1. **Search input** — free-text, debounced 300 ms, dispatches query param update which triggers re-fetch.
2. **Method filter** — multi-select toggle group: `GET POST PUT PATCH DELETE HEAD OPTIONS`. Each button uses `MethodBadge` colour.
3. **Tag filter** — dropdown populated from `OaSpecDocument.tagsText` for the current version. Single-select.
4. **Version badge** — read-only badge showing the active version (e.g. `v2.1.0 — Latest`).

### Column layout

| Column           | Field         | Sortable | Hideable | Notes                                                                                |
| ---------------- | ------------- | -------- | -------- | ------------------------------------------------------------------------------------ |
| **Method**       | `method`      | Yes      | No       | `MethodBadge` component; always visible                                              |
| **Path**         | `path`        | Yes      | No       | Monospace; always visible                                                            |
| **Summary**      | `summary`     | Yes      | Yes      | Truncated to one line; deprecated badge prepended when `deprecated: true`            |
| **Operation ID** | `operationId` | Yes      | Yes      | Monospace; hidden by default                                                         |
| **Tags**         | `tagsText`    | No       | Yes      | Rendered as `<Badge variant="secondary">` per tag                                    |
| **Deprecated**   | `deprecated`  | Yes      | Yes      | Amber "⚠ deprecated" badge; hidden by default (deprecation shown inline in Summary) |

### Row click — detail panel

Clicking a row opens `OperationDetailPanel` as a side sheet. The panel fetches no additional data — it renders from the `OperationHit` payload already in the table (description, parameter IDs, model IDs are present). Parameters and models are fetched lazily when the panel opens via:

- `GET /openapi/api/:apiId/parameters?operationId={id}&version={version}&size=100`
- `GET /openapi/api/:apiId/models?operationId={id}&version={version}&size=100`

### IndexedDataTable conventions

All column headers follow the [IndexedDataTable convention](./index.md#indexeddatatable-convention):

- Clicking a sortable column header sends a new `sort` + `order` query to the server.
- EyeOff appears on hover for hideable columns; clicking hides the column client-side.
- "N columns hidden — Show all" banner appears above the table when any column is hidden.
- Status bar at the bottom: `{from+1}–{from+size} of {total} operations`.

### Pagination

Standard `< Prev | Page N of M | Next >` bar beneath the status bar.

### Redux state

```typescript
interface OperationsTabState {
  query: string
  methodFilter: string[]
  tagFilter: string | null
  sort: { field: string; direction: 'asc' | 'desc' }
  hiddenColumns: Set<string>
  page: number
}
```

Slice: `operationsTabSlice` in `src/store/`. The existing `apisSlice.operationsQuery` should be migrated here.

---

## Key Decisions

**Server-side search, not client-side filter.** The existing `OperationsTab` filters in-browser from a pre-loaded array. The redesigned tab fetches pages from OpenSearch so that large specs (500+ operations) remain fast.

**Sort is server-side.** Clicking a column header dispatches a new `sort` + `order` query. There is no client-side sort — the table always reflects what OpenSearch returns.

**Method and tag filters are additive.** Selecting `GET` and `POST` returns operations matching either method. The tag filter is single-select for simplicity (multi-select can be added later).

**Deprecation inline in Summary.** The deprecated amber badge is rendered inside the Summary column rather than as a standalone column, matching the current implementation. A standalone `Deprecated` column is included but hidden by default for power users who want to sort by it.

---

## Related Documents

- [OpenSearch Indices](../opensearch-indices) — `OaOperationDocument` schema
- [Parameters Tab](./parameters-tab) — linked from the detail panel
- [Models Tab](./models-tab) — linked from the detail panel
- [Search Design](../search-design) — fuzzy multi-match query patterns
