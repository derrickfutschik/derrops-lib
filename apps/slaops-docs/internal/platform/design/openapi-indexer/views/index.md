---
id: index
title: API Detail Tab Views
sidebar_label: Overview
sidebar_position: 1
created_at: 2026-04-19
updated_at: 2026-04-19
implemented_at: ~
author: Derrick
status: draft
tags:
  - openapi-indexer
  - component-design
  - data-pipeline
  - oaspec
  - portal
---

# API Detail Tab Views

This section designs the five data-driven tabs on the API detail page. Each tab surfaces a different slice of the data indexed by the [Indexing Pipeline](../indexing-pipeline) into the five per-tenant OpenSearch indices.

## Tabs Covered

| Tab | Index | Design Doc |
|---|---|---|
| [Versions](./versions-tab) | `oaspec--spec` | Version history, latest/previous badges, stats per version |
| [Operations](./operations-tab) | `oaspec--operation` | HTTP methods, paths, summaries, tags, deprecation |
| [Servers](./servers-tab) | `oaspec--server` | URLs, schemes, host shapes, base paths |
| [Parameters](./parameters-tab) | `oaspec--param` | Names, locations, types, required flags, descriptions |
| [Models](./models-tab) | `oaspec--model` | Schema names, types, usage context, properties |

## Shared Design Principles

### Default to latest version

Every tab defaults to documents where `latest: true` in the relevant index. A version selector (shared across all tabs) allows switching to a previous retained version. The selected version is stored in Redux and persists while the user navigates between tabs.

### Server-side pagination

All tabs are backed by paginated OpenSearch queries. No tab loads all documents up front. OpenSearch defaults: `size=10`, `from=0`. The maximum page size is `100`.

### IndexedDataTable convention

All tabs follow the **IndexedDataTable** convention defined in the [portal CLAUDE.md](../../../../../../../../../slaops-portal/CLAUDE.md):

- **Sortable columns** — header click toggles asc/desc; ArrowUp / ArrowDown / ArrowUpDown icons signal sort state.
- **Hideable columns** — EyeOff button appears on column header hover; a "N hidden — Show all" banner appears when any column is hidden.
- **Status bar** — fixed at the bottom of the table; shows `{filtered}/{total} rows` or `{total} rows`.
- **Sort and column-visibility state lives in Redux** — one slice per tab, keyed by tab name, so state survives tab switches without re-fetching.

### Controller endpoint pattern

Each tab maps to a single `GET` endpoint on `OpenApiIndexerController`. The shape is consistent:

```
GET /openapi/api/:apiId/{resource}
  ?version=   (default: latest)
  &from=      (default: 0)
  &size=      (default: 10, max: 100)
  &sort=      (field name)
  &order=     (asc | desc, default: asc)
  &q=         (free-text, where applicable)
```

Response envelope:

```typescript
interface PagedResult<T> {
  total: number      // OpenSearch hits.total.value
  from: number
  size: number
  version: string    // the actual version returned (echoed from the query)
  hits: T[]
}
```

## Related Documents

- [OpenSearch Indices](../opensearch-indices) — document schemas for `OaSpecDocument`, `OaOperationDocument`, etc.
- [Indexing Pipeline](../indexing-pipeline) — how documents are written into these indices
- [Search Design](../search-design) — OpenSearch query patterns this design builds on
- [UI Design](../ui-design) — high-level API detail view wireframe
