---
id: versions-tab
title: Versions Tab Design
sidebar_label: Versions Tab
sidebar_position: 2
created_at: 2026-04-19
updated_at: 2026-04-19
implemented_at: 2026-04-19
implements:
  - apps/slaops-portal/src/components/apis/VersionsTab.tsx
  - apps/slaops-portal/src/hooks/useVersionsTab.ts
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

# Versions Tab Design

The Versions tab is the version history browser for an API. It shows every OASpec version retained in the `oaspec--spec` index for the selected API, ordered newest-first. The latest version is highlighted; all older versions are labelled "Previous".

## Purpose

- Let the user understand which spec versions are currently indexed.
- Show per-version stats (operation count, server count, etc.) at a glance.
- Allow selecting a version to drive the other tabs (Operations, Servers, Parameters, Models).
- Surface the "Re-index" and future "Diff" actions per version row.

---

## Backend — Controller Endpoint

### `GET /openapi/api/:apiId/versions`

**Path param**: `apiId` — UUID of the API.

**Query params**:

| Param | Default | Notes |
|---|---|---|
| `from` | `0` | OpenSearch `from` |
| `size` | `10` | OpenSearch `size`, max `100` |
| `sort` | `indexedAt` | Field to sort by |
| `order` | `desc` | `asc` or `desc` |

No `version` param — this endpoint always returns all versions, newest first.

**OpenSearch query** (against `slaops--{tenantId}--oaspec--spec`):

```json
{
  "query": { "term": { "apiId": "<apiId>" } },
  "sort": [{ "indexedAt": { "order": "desc" } }],
  "from": 0,
  "size": 10
}
```

**Response DTO**:

```typescript
interface VersionsPageResult {
  total: number
  from: number
  size: number
  hits: VersionHit[]
}

interface VersionHit {
  id: string
  version: string
  latest: boolean
  specVersion: string          // OpenAPI spec version (e.g. "3.0.1")
  indexedAt: string            // ISO timestamp
  operationCount: number
  serverCount: number
  parameterCount: number
  modelCount: number
  fileSize: number
  fileFormat: 'yaml' | 'json'
}
```

Fields map directly to `OaSpecDocument` — no aggregation needed.

---

## Frontend — Component Design

### Column layout

| Column | Field | Sortable | Hideable | Notes |
|---|---|---|---|---|
| **Version** | `version` | Yes | No | Monospace; "Latest" badge when `latest: true` |
| **Spec** | `specVersion` | No | Yes | e.g. `OAS 3.0.1` |
| **Operations** | `operationCount` | Yes | No | Number |
| **Servers** | `serverCount` | Yes | Yes | Number |
| **Parameters** | `parameterCount` | Yes | Yes | Number |
| **Models** | `modelCount` | Yes | Yes | Number |
| **Size** | `fileSize` | Yes | Yes | Human-readable (e.g. `14 KB`) |
| **Format** | `fileFormat` | No | Yes | `yaml` / `json` badge |
| **Indexed At** | `indexedAt` | Yes | No | Relative timestamp (e.g. "3 days ago") with tooltip showing ISO |

### Version badge

The row for `latest: true` shows a green "Latest" badge. Rows where `latest: false` show a muted "Previous" badge. The latest row is always rendered first regardless of the client-side sort because `sort: [{ indexedAt: desc }]` matches that ordering from the server.

### Row click — version selection

Clicking any row sets the **selected version** in Redux (`apisSlice.selectedVersion`). All other tabs read this value and re-fetch when it changes. A subtle "active" background distinguishes the selected row.

### Actions column

| Action | Condition | Behaviour |
|---|---|---|
| Re-index | Always | Triggers `POST /openapi/index` for this version's `s3Bucket` + `s3Key` |
| Diff | Future | Disabled for now; opens a diff view comparing this version against the previous |

### Pagination

Standard pagination bar at the bottom: `< Prev | Page N of M | Next >`. The status bar shows `Showing {from+1}–{from+size} of {total} versions`.

### Redux state

```typescript
interface VersionsTabState {
  sort: { field: string; direction: 'asc' | 'desc' }
  hiddenColumns: Set<string>
  page: number
}
```

Slice: `versionsTabSlice` in `src/store/`.

---

## Key Decisions

**No version selector on this tab.** The Versions tab *is* the version selector — clicking a row selects the version for the other tabs. The other tabs show a read-only version badge in their toolbar.

**Re-index on any version, not just latest.** Any retained version can be re-indexed to refresh its data if the indexing pipeline changes.

**`fileSize` shown in KB.** Raw bytes from `OaSpecDocument.fileSize` are formatted client-side to human-readable KB.

---

## Related Documents

- [OpenSearch Indices](../opensearch-indices) — `OaSpecDocument` schema
- [Operations Tab](./operations-tab) — consumes `selectedVersion`
- [UI Design](../ui-design) — high-level version browser wireframe
