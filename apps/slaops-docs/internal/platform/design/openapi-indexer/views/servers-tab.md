---
id: servers-tab
title: Servers Tab Design
sidebar_label: Servers Tab
sidebar_position: 4
created_at: 2026-04-19
updated_at: 2026-04-19
implemented_at: 2026-04-19
implements:
  - apps/slaops-portal/src/components/apis/ServersTab.tsx
  - apps/slaops-portal/src/hooks/useServersTab.ts
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

# Servers Tab Design

The Servers tab lists all server entries indexed for the selected API version. Servers are the base URLs defined in the OpenAPI spec — they drive host-shape matching in the [API Matching Algorithm](../api-matching) and determine which relay connection to use during API testing.

## Purpose

- Show the full set of servers for the active spec version.
- Expose the host shape and base path extracted by the indexing pipeline, which users may not see in raw spec form.
- Allow sorting by scheme, host shape, or base path.
- Show the server-index ordering from the spec (important for default server selection).

---

## Backend — Controller Endpoint

### `GET /openapi/api/:apiId/servers`

**Path param**: `apiId` — UUID of the API.

**Query params**:

| Param | Default | Notes |
|---|---|---|
| `version` | _(latest)_ | `latest` sentinel or a specific version string |
| `from` | `0` | OpenSearch `from` |
| `size` | `10` | OpenSearch `size`, max `100` |
| `sort` | `serverIndex` | Sortable fields: `serverIndex`, `scheme`, `hostShape`, `basePath`, `rawUrl` |
| `order` | `asc` | `asc` or `desc` |

No free-text search — the server list is typically small (1–5 entries) and pagination is provided for completeness.

**OpenSearch query** (against `slaops--{tenantId}--oaspec--server`):

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "apiId": "<apiId>" } },
        { "term": { "latest": true } }
      ]
    }
  },
  "sort": [{ "serverIndex": { "order": "asc" } }],
  "from": 0,
  "size": 10
}
```

**Response DTO**:

```typescript
interface ServersPageResult {
  total: number
  from: number
  size: number
  version: string
  hits: ServerHit[]
}

interface ServerHit {
  id: string
  serverIndex: number
  rawUrl: string
  scheme: string
  hostTemplate: string
  hostShape: string
  dnsSuffix: string
  basePath: string
  description?: string
  fixedLabelsText: string
  varLabelsText: string
  variablesText?: string
}
```

---

## Frontend — Component Design

### Toolbar

- **Version badge** — read-only, shows the active version.
- No search input (server lists are short; search adds no value here).

### Column layout

| Column | Field | Sortable | Hideable | Notes |
|---|---|---|---|---|
| **#** | `serverIndex` | Yes | No | The position of this server in the spec's `servers[]` array |
| **URL** | `rawUrl` | Yes | No | Monospace; full raw URL from the spec |
| **Scheme** | `scheme` | Yes | No | `https` / `http` / other; `SchemeBadge` coloured component |
| **Host Shape** | `hostShape` | Yes | Yes | Normalised host pattern (e.g. `api.{tenant}.example.com`) |
| **Host Template** | `hostTemplate` | Yes | Yes | Includes scheme and path (e.g. `https://api.{tenant}.example.com`) |
| **Base Path** | `basePath` | Yes | Yes | Monospace; defaults to `/` when absent |
| **DNS Suffix** | `dnsSuffix` | Yes | Yes | e.g. `.example.com` |
| **Variables** | `variablesText` | No | Yes | Space-separated variable names, shown as small badges; hidden by default |
| **Description** | `description` | No | Yes | Truncated; hidden by default |

### IndexedDataTable conventions

All column headers follow the [IndexedDataTable convention](./index.md#indexeddatatable-convention):
- Sorting sends `sort` + `order` to the server via updated query params.
- EyeOff hides a column client-side.
- Status bar at the bottom: `{total} servers`.

Pagination is present for completeness but most APIs will show all servers on the first page (`size=10` covers the typical 1–5 range).

### Redux state

```typescript
interface ServersTabState {
  sort: { field: string; direction: 'asc' | 'desc' }
  hiddenColumns: Set<string>
  page: number
}
```

Slice: `serversTabSlice` in `src/store/`. The existing `ServersTab` component receives servers as a prop from the parent; this is replaced by a hook that fetches from the endpoint.

---

## Key Decisions

**Show `hostShape` alongside `rawUrl`.** The raw URL alone is insufficient for understanding how the indexer matches incoming requests. The host shape (extracted by `HostShapeExtractor`) shows the normalised pattern that drives [API Matching](../api-matching).

**`serverIndex` as the default sort.** The spec order is semantically meaningful — the first server is the "default" server used when making requests. Preserving this ordering by default makes the tab immediately useful.

**No search input.** APIs rarely have more than 5 servers. The overhead of a search bar outweighs the benefit.

---

## Related Documents

- [OpenSearch Indices](../opensearch-indices) — `OaServerDocument` schema
- [API Matching Algorithm](../api-matching) — how `hostShape` and `basePath` drive request routing
- [Spec Field Extraction](../spec-field-extraction) — how server fields are extracted from the raw spec
