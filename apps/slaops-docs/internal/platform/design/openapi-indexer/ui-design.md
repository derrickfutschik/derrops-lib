---
id: ui-design
title: OpenAPI UI Design
sidebar_label: UI Design
sidebar_position: 6
created_at: 2026-04-18
updated_at: 2026-04-18
implemented_at: ~
author: Derrick
status: draft
tags:
  - openapi-indexer
  - component-design
  - architecture
  - oaspec
  - portal
---

# OpenAPI UI Design

This document covers the portal UI for the OASpec domain: the APIs tab, the upload wizard, the version browser, the diff view, and the operation explorer.

## Navigation

The OASpec functionality lives in a dedicated **"APIs"** tab in the portal navigation bar, alongside API Tester, Connections, and Add SaaS. This tab is a full-page experience for managing APIs and their OpenAPI specifications.

---

## Main View: API List

The default view is a tabular list of all APIs for the current tenant, backed by the PostgreSQL `api` table.

| Column             | Source                | Notes                                 |
| ------------------ | --------------------- | ------------------------------------- |
| **Name**           | `api.name`            | Clickable — opens the API detail view |
| **Latest Version** | `api.latest_version`  | e.g. `2.1.0`                          |
| **Operations**     | `api.operation_count` | Count in latest version               |
| **Servers**        | `api.server_count`    | Count in latest version               |
| **Last Indexed**   | `api.last_indexed_at` | Relative time (e.g. "3 days ago")     |
| **Actions**        | —                     | Upload new version, View spec, Delete |

An **"Add API"** button in the top-right opens the [Upload Wizard](#upload-wizard).

---

## API Detail View

Clicking an API name opens the detail view with tabs:

### Versions tab

Lists all versions of this API's spec in OpenSearch (latest to oldest). The latest version is marked with a "Latest" badge.

| Column     | Description                                           |
| ---------- | ----------------------------------------------------- |
| Version    | e.g. `2.1.0`                                          |
| Status     | Latest / Previous                                     |
| Operations | Operation count for this version                      |
| Indexed At | Timestamp                                             |
| Actions    | View spec, Promote to latest (future), Delete version |

Clicking a version row opens a spec viewer panel (re-uses the existing OpenAPI explorer component).

### Operations tab

Powered by the `slaops--{tenantId}--oaspec--operation` index — shows all operations for the latest spec version with a live search filter. Users can search by keyword, filter by HTTP method, and filter by tag.

Clicking an operation row drills into an **Operation Detail panel** showing:

- Summary and description
- Path and method
- Parameters (fetched from `slaops--{tenantId}--oaspec--param`)
- Request/response models (fetched from `slaops--{tenantId}--oaspec--model`)
- A "Try in API Tester" button that pre-fills the API Tester with the operation details

### Spec tab

Renders the raw OpenAPI spec in the existing OpenAPI viewer component (the same viewer used in API Tester). Shows the latest version; a version selector dropdown switches between retained versions.

---

## Upload Wizard

The wizard runs when a user drops a spec file onto the API list or clicks **Upload Spec**. It enforces the API-first constraint: a spec cannot be indexed without a parent API.

### Step 1: Select or identify the spec

The user drops a YAML/JSON file or pastes raw content into a text area. The portal:

1. Parses the spec client-side to extract `info.title` and `info.version`.
2. Displays a summary: title, version, operation count estimate.
3. Proceeds to step 2 automatically if parsing succeeds.

### Step 2: Select or create the parent API

The portal runs two parallel searches using `info.title` as the query:

1. `GET /apis/search?q={title}` — tenant's own existing APIs
2. `GET /openapi/catalogue?q={title}` — platform catalogue (global OpenSearch index, no SQL)

Results are presented in three groups:

**Existing tenant APIs (top group)**

- Selectable list showing name, current version, and operation count.
- User selects the API to upload a new version to it.
- Shows version update confirmation: "Updating **Stripe Payments API** from `v2.0.0` → `v2.1.0`"
- If the new version is lower than or equal to the current version, shows a warning.

**Platform catalogue matches (second group)**

- Shown only if `management_mode: 'platform'` APIs are found in the global index.
- Each row shows title, description, and latest platform-managed version.
- Selecting one creates an `api` row via `POST /apis/adopt` — the user cannot upload their own version for a platform-managed API. The wizard exits after adoption.
- A "Use my own version instead" link bypasses this and falls through to "Create new API".

**Create new API (always available)**

- Pre-fills name from `info.title`.
- User chooses management mode: **Platform-managed** (if a catalogue match exists) or **Self-managed**.
- For self-managed: user picks a version strategy (`manual` or `url_fetch`; `url_fetch` shows a URL and cron field).
- Creates the `api` row, then proceeds to step 3.

### Step 3: Pre-index validation warnings

Before submitting the spec for indexing, the portal runs a set of client-side checks and shows warnings (non-blocking — the user can proceed):

| Warning                          | Condition                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **API mismatch**                 | The spec's `info.title` differs significantly from the selected API's name (fuzzy string distance > threshold) |
| **Server mismatch**              | None of the spec's servers share a domain with the existing indexed servers for this API                       |
| **Version regression**           | New `info.version` is lexicographically lower than the current indexed version                                 |
| **Breaking change (minor bump)** | Semver indicates a minor version bump, but the spec removes existing operations or changes required parameters |

Breaking change detection uses the diff computed from a client-side comparison of the newly parsed spec against the spec fetched from OpenSearch for the current version.

### Step 4: Confirm and index

User clicks **"Index Spec"**. The portal:

1. Uploads the spec to the staging bucket via the pre-signed URL from `POST /openapi/upload-url`.
2. Calls `POST /openapi/index` with `{ api_id, bucket, key }`.
3. Shows a progress indicator while the pipeline runs.

### Step 5: Indexing result and diff view

After indexing completes, the wizard shows the `IndexingResponse` and a visual diff:

```
✓ Indexed Stripe Payments API v2.1.0 in 3.2s

Changes from v2.0.0 → v2.1.0:
  + 3 new operations added
      POST /v2/charges/batch
      GET  /v2/invoices/upcoming
      POST /v2/customers/{id}/verify-identity

  ~ 2 operations updated
      GET  /v2/charges          (added ?limit query parameter)
      POST /v2/customers/{id}   (response body field added: tax_id)

  - 1 operation removed
      DELETE /v2/legacy/charges

  + 1 new server added
      https://api.stripe.com/v2

Indexed: 184 operations · 12 servers · 97 parameters · 43 models
```

The diff is computed by comparing the current version's indexed operations (fetched from OpenSearch) against the newly indexed operations.

---

## Operation Explorer (Standalone)

Accessible from the sidebar or via the Operations tab on an API, the Operation Explorer is a full-page search UI backed by `slaops--{tenantId}--oaspec--operation`.

Features:

- **Search bar:** free-text query across all operations (semantic, fuzziness AUTO)
- **Filters:** HTTP method (multi-select), API name, tag
- **Results:** operation card showing method, path, summary, and which API it belongs to
- **Detail panel:** clicking an operation shows full details, parameters, request/response models, and a "Try in API Tester" button

This is distinct from the per-API Operations tab — it searches across all APIs, making it useful for discovering which API to use for a given task.

---

## Component Summary

| Component          | Backed By                                                                | Location in Portal             |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------ |
| API List           | PostgreSQL `api`                                                         | APIs tab — main view           |
| Version Browser    | `slaops--{tenantId}--oaspec--spec` (OpenSearch)                          | API detail → Versions tab      |
| Operations tab     | `slaops--{tenantId}--oaspec--operation` (OpenSearch)                     | API detail → Operations tab    |
| Spec Viewer        | S3 (raw spec) / OpenSearch                                               | API detail → Spec tab          |
| Upload Wizard      | `POST /openapi/index` pipeline                                           | Modal / wizard flow            |
| Diff View          | `slaops--{tenantId}--oaspec--operation` comparison                       | Step 5 of Upload Wizard        |
| Operation Explorer | `slaops--{tenantId}--oaspec--operation` (OpenSearch)                     | APIs tab → Operations sub-page |
| Operation Detail   | `slaops--{tenantId}--oaspec--param`, `slaops--{tenantId}--oaspec--model` | Slide-out panel                |

---

## Related Documents

- [API Data Model](./api-oaspec-data-model) — `api` table, management mode, and version strategy columns
- [Version Strategies](./version-strategies) — platform catalogue, url_fetch behaviour, future strategies
- [Indexing Pipeline](./indexing-pipeline) — the pipeline triggered by the wizard
- [Search Design](./search-design) — OpenSearch queries behind the operation explorer and operations tab
- [OpenSearch Indices](./opensearch-indices) — document schemas for each entity type
