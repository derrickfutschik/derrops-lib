---
id: search-design
title: Search Design
sidebar_label: Search Design
sidebar_position: 5
created_at: 2026-04-18
updated_at: 2026-04-18
implemented_at: ~
author: Derrick
status: draft
tags:
  - openapi-indexer
  - data-pipeline
  - architecture
  - oaspec
---

# Search Design

This document covers the five search use-cases across the OASpec domain — how operations, servers, APIs, parameters, and models are queried — and the fast-path enrichment lookup used during log ingestion.

---

## Search Modes

Three named search modes are used throughout this document. See [OpenAPI Index Access Pattern](./openapi-index-access-pattern#search-modes) for the full definition.

| Mode               | Target                                                  | When to use                                             |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------- |
| **Global Search**  | `derrops--{tenantId}--oaspec--{entity}--search` (alias) | Tenant + platform data — discovery, enrichment          |
| **Tenant Search**  | `derrops--{tenantId}--oaspec--{entity}` (direct)        | Tenant-only data — version management, listing own APIs |
| **Managed Search** | `derrops--t-glbl0000--oaspec--{entity}` (direct)        | Platform catalogue only — wizard browse, stats sync     |

---

## Use-Cases Overview

| Use-Case           | Mode                     | Primary Purpose                                        |
| ------------------ | ------------------------ | ------------------------------------------------------ |
| API Search         | Global Search            | Find the right API for a task; browse the catalogue    |
| Server Search      | Global Search            | Match an incoming request host to a known API server   |
| Operation Search   | Global Search            | Find the right operation; semantic cross-API discovery |
| Parameter Search   | Global Search            | Discover parameters by name/type across all APIs       |
| Model Search       | Global Search            | Look up schemas; understand request/response shapes    |
| Catalogue Browse   | Managed Search           | Wizard step: list/search the platform catalogue        |
| Version Management | Tenant Search            | List/delete versions of a tenant's own API             |
| Enrichment Lookup  | Global Search + DynamoDB | Real-time request→spec matching during log ingestion   |

Most portal searches include `{ term: { latest: true } }` unless the user is explicitly browsing version history.

---

## 1. API Search

**Mode:** Global Search — **Target:** `derrops--{tenantId}--oaspec--spec--search` (alias)

The simplest search. Given a free-text query, finds API specs whose `title` or `description` best match.

```
GET /openapi/search/apis?q=payment+processing&tags=billing&size=20
```

**OpenSearch query:**

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "payment processing",
            "fields": ["title^3", "description^2", "tagsText^2"],
            "fuzziness": "AUTO"
          }
        }
      ],
      "filter": [
        { "term": { "tenantId": "<tenantId>" } },
        { "term": { "latest": true } },
        { "term": { "tagsText": "billing" } }
      ]
    }
  },
  "aggs": {
    "tags": { "terms": { "field": "tagsText", "size": 30 } }
  }
}
```

---

## 2. Server Search

**Mode:** Global Search — **Target:** `derrops--{tenantId}--oaspec--server--search` (alias)

Used to determine which API a given request URL belongs to. The goal is to find the server entry whose `host_shape` and `base_path` best match the incoming request.

### Host Shape Derivation

Given an incoming request URL `https://cloudtrail.ap-southeast-9.amazonaws.com/v1/trail/list`:

1. Parse the URL: `scheme=https`, `host=cloudtrail.ap-southeast-9.amazonaws.com`, `path=/v1/trail/list`
2. Identify the DNS suffix (public suffix + 1 label): `amazonaws.com`
3. Extract subdomain labels before the suffix: `["cloudtrail", "ap-southeast-9"]`
4. Generate candidate host shapes — replace each non-last label independently with `*`:
   - `cloudtrail.*.amazonaws.com` (replace second label)
   - `*.ap-southeast-9.amazonaws.com` (replace first label)
   - Note: `*.*.amazonaws.com` is invalid — at least one non-suffix label must be fixed

```typescript
function deriveHostShapes(host: string): string[] {
  // Returns all valid host shapes for an incoming request host
}
```

5. Query OpenSearch for server documents matching any of the candidate shapes.

### Base Path Disambiguation

Multiple APIs may share the same `hostShape`. After finding all matching servers, filter to those whose `basePath` is a prefix of the request path. Select the server with the **longest matching base path** (most specific).

```
Request path: /v1/shipping/customers/abcd/logout

Matching APIs:
  Customer API  base_path = /v1/shipping/customers/  ← longest match, wins
  Shipping API  base_path = /v1/shipping/
  Root API      base_path = /
```

### OpenSearch Query

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "tenantId": "<tenantId>" } },
        { "term": { "latest": true } },
        {
          "terms": { "hostShape": ["cloudtrail.*.amazonaws.com", "*.ap-southeast-9.amazonaws.com"] }
        }
      ]
    }
  },
  "size": 20
}
```

After fetching results, longest-base-path selection is performed in application code, not in OpenSearch.

---

## 3. Operation Search

**Mode:** Global Search — **Target:** `derrops--{tenantId}--oaspec--operation--search` (alias)

The richest search. Users query across all operations in all indexed APIs to find the operation they need.

```
GET /openapi/search/operations?q=create+customer+account&method=POST&tag=customers
```

**OpenSearch query (semantic):**

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "create customer account",
            "fields": ["summary^3", "description^2", "tagsText^2", "operationId"],
            "fuzziness": "AUTO",
            "type": "best_fields"
          }
        }
      ],
      "filter": [
        { "term": { "tenantId": "<tenantId>" } },
        { "term": { "latest": true } },
        { "term": { "method": "POST" } },
        { "term": { "tagsText": "customers" } }
      ]
    }
  },
  "highlight": {
    "fields": { "summary": {}, "description": {} }
  }
}
```

### Operation Matching (Enrichment Fast Path)

During log enrichment, the goal is a precise method+path match against a known API's operations — not a fuzzy text search. This uses the compacted `pathKey` format.

**Compaction rules:**

- HTTP method: first character, uppercase (`G`, `P`, `D`, `A` for PATCH, `H`, `O`)
- Path segments:
  - Literal segments: kept as-is
  - `{param}` where the schema type is integer-ish → `{i}`
  - `{param}` where the schema type is string → `{s}`

Examples:

```
GET /users/{userId}/orders     → G:users/{i}/orders
POST /accounts/{id}/withdraw   → P:accounts/{s}/withdraw
DELETE /items/{itemId}         → D:items/{i}
```

**Matching a request:**

1. Construct the path key for the incoming request by replacing path segments with typed wildcards.
2. Query the DynamoDB cache for `{tenantId}:{hostShape}/{basePath}/{pathKey}`.
3. On cache miss, query `derrops--{tenantId}--oaspec--operation` with `term: { pathKey }` + `term: { method }` + server filter.
4. On cache hit, return the operation document directly.

**DynamoDB cache schema:**

| Attribute     | Description                                                               |
| ------------- | ------------------------------------------------------------------------- |
| `PK`          | `{tenantId}:{hostShape}`                                                  |
| `SK`          | `{basePath}`                                                              |
| `specId`      | OpenSearch spec document ID                                               |
| `serverIndex` | Index in the spec's server array                                          |
| `ttl`         | Unix timestamp (5 min TTL, `config['dynamodb.oaspec-cache.ttl-seconds']`) |

The DynamoDB cache only stores the `host_shape → spec_id + server_index` mapping — not the operation itself. Once the spec is resolved, the operation is matched in-memory against the pre-fetched operation list. This avoids one additional cache entry per operation while still keeping the lookup sub-millisecond for repeat requests.

---

## 4. Parameter Search

**Mode:** Global Search — **Target:** `derrops--{tenantId}--oaspec--param--search` (alias)

Useful for discovering common parameter patterns across APIs or finding a specific parameter by name.

```
GET /openapi/search/params?q=api_key&location=header&type=string
```

**OpenSearch query:**

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "api_key",
            "fields": ["name^3", "description"],
            "fuzziness": "AUTO"
          }
        }
      ],
      "filter": [
        { "term": { "tenantId": "<tenantId>" } },
        { "term": { "latest": true } },
        { "term": { "location": "header" } },
        { "term": { "schemaType": "string" } }
      ]
    }
  }
}
```

---

## 5. Model Search

**Mode:** Global Search — **Target:** `derrops--{tenantId}--oaspec--model--search` (alias)

Allows searching across all schema definitions — useful when the user knows a model name but not which API it belongs to.

```
GET /openapi/search/models?q=PaymentMethod&apiId=<uuid>
```

**OpenSearch query:**

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "PaymentMethod",
            "fields": ["name^3", "description", "propertiesText"],
            "fuzziness": "AUTO"
          }
        }
      ],
      "filter": [{ "term": { "tenantId": "<tenantId>" } }, { "term": { "latest": true } }]
    }
  }
}
```

---

## Enrichment Lookup (Hot Path)

**Mode:** Global Search — must match both tenant-private and platform-managed APIs.

The hot path is the sequence executed for every incoming HTTP request during real-time log enrichment at the relay:

```
1. Receive HTTP request (host, path, method)
2. Derive candidate host shapes from the request host
3. DynamoDB lookup: { PK: tenant:hostShape, SK: basePath }
4.   Cache hit → return specId + serverIndex
5.   Cache miss →
        a. Global Search: derrops--{tenantId}--oaspec--server--search for matching host shapes
        b. Select server by longest basePath match
        c. Write to DynamoDB cache
6. From specId, resolve operation:
        a. Fetch operation list from in-memory cache (keyed by specId)
        b. Cache miss → Global Search: derrops--{tenantId}--oaspec--operation--search
                        where specId + latest=true
        c. Construct path key for request
        d. Match path key against operations using prefix trie
7. Attach matched operation to the log event
8. Index enriched log to OpenSearch logging index
```

**In-memory operation trie.** The relay process builds a path-key prefix trie per spec, keyed by `specId`. For a given spec, operations are inserted into the trie as `{method_initial}:{segments}`. A new request is matched by walking the trie. The trie is rebuilt on cache invalidation (triggered by TTL expiry or push notification when a new spec version is indexed).

**Enrichment only uses `latest: true` operations.** Real-time matching is always against the current version of each API. Historical versions are searchable in the portal but not used in the enrichment hot path.

---

## REST API Endpoints

| Method | Path                                 | Description                                |
| ------ | ------------------------------------ | ------------------------------------------ |
| `GET`  | `/openapi/search/apis`               | Search specs by title/description/tags     |
| `GET`  | `/openapi/search/operations`         | Semantic search across all operations      |
| `GET`  | `/openapi/search/servers`            | Find servers by host pattern               |
| `GET`  | `/openapi/search/params`             | Search parameters by name/type             |
| `GET`  | `/openapi/search/models`             | Search models/schemas by name              |
| `GET`  | `/openapi/search/operations/:specId` | All operations for a specific spec version |
| `GET`  | `/openapi/search/models/:specId`     | All models for a specific spec version     |

---

## Related Documents

- [OpenSearch Indices](./opensearch-indices) — document schemas searched in each use-case
- [Indexing Pipeline](./indexing-pipeline) — how `pathKey`, `hostShape`, and `basePath` are populated at index time
- [OpenAPI Index Access Pattern](./openapi-index-access-pattern) — alias strategy for two-tier (managed + tenant) search
- [UI Design](./ui-design) — portal components that drive operation and API search
