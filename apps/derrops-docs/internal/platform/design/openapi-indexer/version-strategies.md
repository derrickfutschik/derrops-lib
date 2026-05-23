---
id: version-strategies
title: API Version Strategies
sidebar_label: Version Strategies
sidebar_position: 7
created_at: 2026-04-18
updated_at: 2026-04-18
implemented_at: ~
author: Derrick
status: draft
tags:
  - openapi-indexer
  - data-pipeline
  - component-design
  - architecture
  - oaspec
---

# API Version Strategies

This document covers how the platform manages OpenAPI spec versions for a tenant's APIs — the two management modes (platform vs. private), the platform catalogue, and the set of version strategies available to privately-managed APIs.

---

## Management Modes

Every `api` row carries a `management_mode` that determines who is responsible for delivering spec versions.

| Mode       | Who manages versions      | Spec data lives in                                      |
| ---------- | ------------------------- | ------------------------------------------------------- |
| `platform` | Derrops platform pipeline | Global index (`derrops--t-glbl0000--oaspec--*`)         |
| `private`  | The tenant                | Tenant private index (`derrops--{tenantId}--oaspec--*`) |

In both modes the tenant has a row in the `api` table — representing their interest in that API — and the search alias transparently resolves spec data from whichever index holds it. No global rows are written to RDS.

---

## Platform-Managed Mode

When a tenant adopts a platform-managed API (via the wizard's catalogue search), the platform pipeline keeps the spec up to date automatically. The tenant's `api` row stores a reference to the global OpenSearch document (`global_opensearch_id = t-glbl0000-{hash}`) and a cached copy of the latest aggregate stats.

```
Tenant api row (management_mode: 'platform')
  ├── oaSpec.globalOpensearchId   (spec_global_opensearch_id)  → points into derrops--t-glbl0000--oaspec--spec
  ├── oaSpec.latestVersion        (spec_latest_version)        → cached from global doc (refreshed by stats sync job)
  ├── oaSpec.operationCount       (spec_operation_count)       ↑
  ├── oaSpec.serverCount          (spec_server_count)          ↑
  └── oaSpec.lastIndexedAt        (spec_last_indexed_at)       ↑
```

### Platform catalogue

The set of platform-managed APIs is the contents of the global index — it is **OpenSearch only**. There are no `api` rows for global APIs until a tenant adopts one. The wizard queries the catalogue directly:

```
GET /openapi/catalogue?q={query}&limit=10
→ searches derrops--t-glbl0000--oaspec--spec
→ returns: [{ title, description, latest_version, operation_count, server_count }]
```

No SQL is involved. The catalogue is always current with the global index.

### Stats sync job

A nightly job refreshes the cached stats on all `management_mode: 'platform'` rows by reading the corresponding global spec document from OpenSearch and updating `latest_version`, `operation_count`, `server_count`, `parameter_count`, `model_count`, and `last_indexed_at`. If the global spec is removed (deprecated upstream), the `api` row is flagged with a warning status but not deleted — the tenant retains their record.

### What tenants can customise

Even in platform mode tenants can override `name`, `description`, and `external_url` on their `api` row. They cannot upload their own versions — switching to `management_mode: 'private'` is required for that.

---

## Private Mode

When `management_mode: 'private'`, the tenant controls when and how new versions arrive. The `version_strategy` field on the `api` row determines the mechanism.

```
Tenant api row (management_mode: 'private')
  ├── version_strategy      → 'manual' | 'url_fetch' | ...
  ├── version_fetch_url     → nullable, used by url_fetch
  └── version_fetch_cron    → nullable, cron expression
```

---

## Version Strategies

### `manual`

The tenant uploads spec files directly via the portal wizard or the REST API. No automation. This is the default strategy when creating a private API.

**Trigger:** user-initiated only — wizard upload or `POST /openapi/index`.

---

### `url_fetch`

:::info Future State
The `url_fetch` scheduled job is designed but **not yet implemented**. The `fetch_*` columns are stored on the `api` row and `version_strategy: 'url_fetch'` is accepted by the API, but no scheduler runs automatically. Manual triggering via `POST /apis/:id/fetch` is also deferred to this phase. When implemented, this will require `@nestjs/schedule` and a new `url-fetch.scheduler.ts` service.
:::

The platform periodically fetches the spec from a configured URL and re-indexes if the content has changed.

**Configuration:**

| Field                | Description              | Example                               |
| -------------------- | ------------------------ | ------------------------------------- |
| `version_fetch_url`  | URL to GET the spec from | `https://api.stripe.com/openapi.yaml` |
| `version_fetch_cron` | Cron schedule (UTC)      | `0 2 * * *` (daily at 02:00 UTC)      |

**Fetch behaviour:**

1. `GET {version_fetch_url}` with a 30-second timeout.
2. Parse the response as YAML or JSON.
3. Extract `info.version`. If it matches `api.oaSpec.latestVersion` exactly, skip — no re-index.
4. If the version is new, write the spec file to the tenant's OASpec bucket (`{region}--{env}--derrops--{tenantId}--oaspec--storage--specs`) under the standard key `APIs/{provider}/{service}/{version}/openapi.yaml`.
5. Run the full indexing pipeline against the stored bucket object (same flow as a manual upload).
6. Record `fetchState.lastAt`, `fetchState.lastStatus` (`ok` | `error`), and `fetchState.lastError` on the `api` row.

**Error handling:**

- On fetch failure (timeout, non-2xx, parse error): log the error, set `last_fetch_status: 'error'`, and leave the current indexed version unchanged.
- Exponential backoff for repeated failures: after 3 consecutive failures, reduce to weekly retries and surface a warning badge in the portal.
- A tenant can manually trigger an immediate re-fetch via `POST /apis/:id/fetch`.

**Content-change detection:**

Version comparison uses `info.version` string equality. If the remote spec updates without bumping the version, it will not be re-indexed automatically. Tenants can force a re-index via `POST /apis/:id/fetch?force=true`.

---

## Future Strategies

The `version_strategy` field is extensible. Planned future strategies:

| Strategy        | Description                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| `github_sync`   | Poll a GitHub repository path for spec file changes; trigger on new commits   |
| `registry_sync` | Watch a spec registry (e.g. Bump.sh, Stoplight) for published versions        |
| `webhook`       | Receive a webhook from CI/CD — spec is pushed to the platform on each release |

Adding a new strategy requires: a new `version_strategy` value, any additional config columns on `api`, a scheduler entry, and a fetch/parse handler in the indexer service.

---

## Switching Modes

| Transition             | What happens                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform` → `private` | Tenant takes ownership. The existing global spec documents remain in the global index (unchanged). A private index is provisioned lazily on first upload. The `global_opensearch_id` reference is cleared.     |
| `private` → `platform` | Only allowed if the API exists in the platform catalogue. The tenant's private index documents for this API are deleted (or retained, configurable). `global_opensearch_id` is set to the matching global doc. |

---

## S3 Bucket Isolation

:::info Future State
Per-tenant dedicated S3 buckets are a future infrastructure task. Currently a **single shared bucket** is used (`derrops.oaspec.storage.bucket`) with all object keys prefixed by `{tenantId}/` — e.g. `t-acme0001/APIs/stripe.com/payments/2024-01/openapi.yaml`. This provides logical isolation without the provisioning overhead of per-tenant buckets. Dedicated per-tenant buckets will be introduced when stronger IAM isolation or billing granularity is required.
:::

---

## Configuration

```typescript
/** Default cron schedule for url_fetch strategy (UTC) */
'oaspec.url-fetch.default-cron': '0 2 * * *',

/** Fetch timeout in milliseconds */
'oaspec.url-fetch.timeout-ms': 30_000,

/** Consecutive failures before reducing to weekly retry cadence */
'oaspec.url-fetch.backoff-threshold': 3,
```

---

## Related Documents

- [OASpec Bucket](/docs/oaspec-bucket) — bucket naming conventions and tenant isolation
- [API Data Model](./api-oaspec-data-model) — `managementMode`, `versionStrategy`, and related columns on the `api` table; raw spec storage section
- [Indexing Pipeline](./indexing-pipeline) — the pipeline triggered by all version strategies
- [OpenAPI Index Access Pattern](./openapi-index-access-pattern) — how the global and private indices are resolved via alias
- [UI Design](./ui-design) — wizard catalogue search and version strategy configuration
