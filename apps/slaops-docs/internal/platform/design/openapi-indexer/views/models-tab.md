---
id: models-tab
title: Models Tab Design
sidebar_label: Models Tab
sidebar_position: 6
created_at: 2026-04-19
updated_at: 2026-04-19
implemented_at: 2026-04-19
implements:
  - apps/slaops-portal/src/components/apis/ModelsTab.tsx
  - apps/slaops-portal/src/hooks/useModelsTab.ts
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

# Models Tab Design

The Models tab lists all schema model documents indexed for the selected API version from the `oaspec--model` index. Each row represents a named schema from the spec's `components/schemas` section, enriched with usage context (`request`, `response`, or both) and a property summary.

## Purpose

- Browse the full schema vocabulary defined by the spec.
- Identify whether a model is used as a request body, a response body, or both.
- Search models by name or description.
- Open a detail panel showing the full properties list and which operations reference the model.

---

## Backend — Controller Endpoint

### `GET /openapi/api/:apiId/models`

**Path param**: `apiId` — UUID of the API.

**Query params**:

| Param | Default | Notes |
|---|---|---|
| `version` | _(latest)_ | `latest` sentinel or a specific version string |
| `from` | `0` | OpenSearch `from` |
| `size` | `10` | OpenSearch `size`, max `100` |
| `sort` | `name` | Sortable fields: `name`, `schemaType` |
| `order` | `asc` | `asc` or `desc` |
| `q` | _(empty)_ | Full-text search across `name`, `description`, `propertiesText` |
| `usedIn` | _(all)_ | Filter by usage context: `request`, `response` |
| `operationId` | _(all)_ | Filter to models used by a specific operation ID (used by the Operation Detail panel) |

**OpenSearch query** (against `slaops--{tenantId}--oaspec--model`):

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "apiId": "<apiId>" } },
        { "term": { "latest": true } }
      ],
      "must": [
        {
          "multi_match": {
            "query": "<q>",
            "fields": ["name", "description", "propertiesText"],
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

When `usedIn` is set, add `match: { usedInText: "<usedIn>" }` to `bool.filter`. When `operationId` is set, add `match: { operationIdsText: "<operationId>" }` to `bool.filter`. The `must` multi-match clause is omitted when `q` is empty.

**Response DTO**:

```typescript
interface ModelsPageResult {
  total: number
  from: number
  size: number
  version: string
  hits: ModelHit[]
}

interface ModelHit {
  id: string
  name: string
  description?: string
  schemaType: string
  propertiesText: string
  operationIdsText: string
  usedInText: string
}
```

---

## Frontend — Component Design

### Toolbar

1. **Search input** — free-text, debounced 300 ms, searches across `name`, `description`, and `propertiesText`.
2. **Used In filter** — pill group: `All | Request | Response`. Pills use the existing `USED_IN_CLASSES` colour map (`request` = blue, `response` = green).
3. **Version badge** — read-only.

### Column layout

| Column | Field | Sortable | Hideable | Notes |
|---|---|---|---|---|
| **Name** | `name` | Yes | No | Bold; always visible |
| **Type** | `schemaType` | Yes | No | Monospace badge (e.g. `object`, `array`) |
| **Used In** | `usedInText` | No | No | Space-separated `request` / `response` badges with `USED_IN_CLASSES` colours |
| **Properties** | `propertiesText` | No | Yes | Property count as a number (e.g. "12 properties"); hover shows first 5 names |
| **Operations** | `operationIdsText` | No | Yes | "N operations" count with tooltip list; hidden by default |
| **Description** | `description` | No | Yes | Truncated to one line |

### Row click — detail panel

Clicking a row opens `ModelDetailPanel` as a side sheet. The panel renders from the `ModelHit` payload already in the table — no additional API call is required. It shows:
- Full description
- Schema type
- Property list parsed from `propertiesText`
- Usage context badges
- A list of referencing operations (from `operationIdsText`)

### IndexedDataTable conventions

All column headers follow the [IndexedDataTable convention](./index#indexeddatatable-convention):
- Sorting sends `sort` + `order` to the server.
- EyeOff hides a column client-side.
- Status bar at the bottom: `{filtered}/{total} models` when a filter is active, otherwise `{total} models`.

### Pagination

Standard `< Prev | Page N of M | Next >` bar beneath the status bar.

### Redux state

```typescript
interface ModelsTabState {
  query: string
  usedInFilter: 'request' | 'response' | null
  sort: { field: string; direction: 'asc' | 'desc' }
  hiddenColumns: Set<string>
  page: number
}
```

Slice: `modelsTabSlice` in `src/store/`. The existing `apisSlice.modelsQuery` should be migrated here.

---

## Key Decisions

**Properties as a count, not inline list.** The `propertiesText` field is a space-separated list of property names. Rendering all properties inline would overflow the column for complex models. The count with a hover tooltip gives a useful summary without layout issues.

**`usedIn` as a pill filter, not a column filter.** The existing `ModelsTab` renders `usedInText` tokens as coloured badges per row. The redesign adds a filter toolbar pill that sends `usedIn` to the server, reducing the result set. The coloured badges remain in the table column.

**Detail panel renders from payload.** The `propertiesText` field contains enough information to render a property list in the detail panel without a separate endpoint. This avoids an extra round-trip and keeps the panel fast.

**Server-side search against `propertiesText`.** Users often search for a model by a property name (e.g. "where is `customerId` used?"). Including `propertiesText` in the `multi_match` fields makes this possible from the main search box without adding a separate "search by property" input.

---

## Related Documents

- [OpenSearch Indices](../opensearch-indices) — `OaModelDocument` schema
- [Operations Tab](./operations-tab) — links to this tab from the Operation Detail panel
- [Spec Field Extraction](../spec-field-extraction) — how models are extracted and `usedInText` is populated
