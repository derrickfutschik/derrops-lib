---
id: api-matching
title: API Matching Algorithm
sidebar_label: API Matching
sidebar_position: 9
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

# API Matching Algorithm

This document specifies the full algorithm for matching an incoming HTTP request to an indexed OpenAPI operation — the three-stage pipeline of server resolution, base-path disambiguation, and operation matching. It also contains the reference test cases for known URL patterns.

The matching algorithm runs in the enrichment hot path (see [Search Design — Enrichment Lookup](./search-design#enrichment-lookup-hot-path)) and is the foundation for log enrichment at the relay.

---

## Overview

Given an incoming request `(scheme, host, path, method)`, the algorithm produces a matched `(apiId, specId, operationId)` or `null`.

```
Stage 1 — Server Resolution
  Input:  host (e.g. "cloudtrail.ap-southeast-9.amazonaws.com")
  Output: one or more candidate (apiId, specId, serverIndex) tuples

Stage 2 — Base Path Disambiguation
  Input:  candidate servers + request path
  Output: single (apiId, specId, serverIndex)

Stage 3 — Operation Matching
  Input:  specId + method + request path
  Output: matched operationId (or null)
```

---

## Stage 1 — Server Resolution

### Host Shape Derivation

The server index stores a `hostShape` per server — the server's hostname template with all path-parameter variables replaced by `*`. To find matching servers for an incoming request, the algorithm generates all valid host shapes for the request's host, then queries the server index for any of them.

**Algorithm:**

Given host `cloudtrail.ap-southeast-9.amazonaws.com`:

1. Identify the DNS suffix (public suffix + one label): `amazonaws.com`
2. Extract subdomain labels before the suffix: `["cloudtrail", "ap-southeast-9"]`
3. Generate candidate shapes by replacing each non-suffix label independently with `*`:

```
cloudtrail.*.amazonaws.com       ← replace "ap-southeast-9" with *
*.ap-southeast-9.amazonaws.com   ← replace "cloudtrail" with *
```

**Validity rule:** At least one non-suffix label must remain fixed. An all-wildcard subdomain (`*.*.amazonaws.com`) is never generated — it would match every API on that suffix and produce useless results.

For a host with N subdomain labels, the number of candidate shapes is at most N (one per position, replacing that position with `*`). The original unmodified host (no wildcards) is also a valid candidate — it matches server entries for APIs without path-parameter variables in their hostname.

```typescript
function deriveHostShapes(host: string): string[] {
  // Returns the original host + all one-wildcard variants.
  // Never returns a shape where every subdomain label is *.
}
```

### Host Shape Query

```json
GET /derrops--{tenantId}--oaspec--server--search/_search
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "latest": true } },
        { "terms": { "hostShape": [
            "cloudtrail.*.amazonaws.com",
            "*.ap-southeast-9.amazonaws.com",
            "cloudtrail.ap-southeast-9.amazonaws.com"
          ]
        }}
      ]
    }
  }
}
```

The query uses the **Global Search** alias so platform-managed servers (in `derrops--t-glbl0000--oaspec--server`) are resolved alongside tenant-private servers. See [OpenAPI Index Access Pattern — Search Modes](./openapi-index-access-pattern#search-modes).

---

## Stage 2 — Base Path Disambiguation

Multiple APIs can share the same `hostShape` (e.g. many AWS services on `*.amazonaws.com`). After stage 1 returns candidate servers, the algorithm selects the single best match using the request path.

**Algorithm:** From all candidate servers, keep only those whose `basePath` is a prefix of the request path. Among those, select the server with the **longest matching `basePath`** (most specific wins).

```
Request path: /v1/shipping/customers/abcd/logout

Candidate servers:
  Customer API  basePath = /v1/shipping/customers/  ← longest prefix match — wins
  Shipping API  basePath = /v1/shipping/
  Root API      basePath = /
```

Base path selection is performed in application code after the OpenSearch query returns. It is not delegated to OpenSearch.

---

## Stage 3 — Operation Matching

Once `specId` is known, the algorithm matches the request's method and path against the spec's indexed operations using the compacted `pathKey` format.

### Path Key Format

Each operation is stored with a `pathKey` — a compact string encoding of method + path that supports fast matching:

```
{method_initial}:{compacted_path}
```

**Method initials:**

| Method  | Initial |
| ------- | ------- |
| GET     | `G`     |
| POST    | `P`     |
| PUT     | `U`     |
| DELETE  | `D`     |
| PATCH   | `A`     |
| HEAD    | `H`     |
| OPTIONS | `O`     |

**Path compaction rules:**

| Segment                                    | Compacted form                |
| ------------------------------------------ | ----------------------------- |
| Literal segment                            | unchanged — `users`, `orders` |
| `{param}` where schema type is integer-ish | `{i}`                         |
| `{param}` where schema type is string      | `{s}`                         |

Examples:

```
GET  /users/{userId}/orders        → G:users/{i}/orders
POST /accounts/{id}/withdraw       → P:accounts/{s}/withdraw
DELETE /items/{itemId}             → D:items/{i}
GET  /v1/cloudtrail/trails         → G:v1/cloudtrail/trails
```

### Matching Algorithm

Operations for a given spec are loaded from OpenSearch on first miss and held in an in-memory prefix trie keyed by `specId`. The trie is keyed by `pathKey` segments. For an incoming request:

1. Compact the request path using the same rules (integer-ish segments → `{i}`, others → `{s}`).
2. Walk the trie to find the best matching `pathKey`.
3. Return the matched `operationId`.

The trie is invalidated when a new version is indexed for the spec (push notification or TTL expiry). See [Search Design — Enrichment Lookup](./search-design#enrichment-lookup-hot-path) for the full hot-path sequence including DynamoDB caching.

---

## Server Document Schema (Matching Fields)

The fields on `OaServerDocument` that drive matching (see [OpenSearch Indices — Server Index](./opensearch-indices#2-server-index-derrops--tenantid--oaspec--server) for the full schema):

| Field             | Type      | Role                                                             |
| ----------------- | --------- | ---------------------------------------------------------------- |
| `hostShape`       | `keyword` | Primary lookup key — host template with all vars replaced by `*` |
| `basePath`        | `keyword` | Path prefix for stage 2 disambiguation                           |
| `dnsSuffix`       | `keyword` | Public suffix + one label — used during shape generation         |
| `hostTemplate`    | `text`    | Raw hostname with `{variable}` placeholders — human display      |
| `fixedLabelsText` | `text`    | Space-separated fixed subdomain labels                           |
| `varLabelsText`   | `text`    | Space-separated variable names (e.g. `"region"`)                 |

---

## Reference Test Cases — Known URL Patterns

These test cases define the expected `hostShape` output for known real-world URL patterns. They are used to validate the host shape derivation algorithm.

| Service                       | URL Pattern                                               | Expected `hostShape`                             |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| AWS S3 (legacy path-style)    | `https://s3.{region}.amazonaws.com`                       | `s3.*.amazonaws.com`                             |
| AWS S3 (virtual-hosted style) | `https://{bucket}.s3.{region}.amazonaws.com`              | `*.s3.*.amazonaws.com`                           |
| AWS S3 (dual-stack)           | `https://s3.dualstack.{region}.amazonaws.com`             | `s3.dualstack.*.amazonaws.com`                   |
| AWS API Gateway (REST)        | `https://{restapi-id}.execute-api.{region}.amazonaws.com` | `*.execute-api.*.amazonaws.com`                  |
| AWS STS (global legacy)       | `https://sts.amazonaws.com`                               | `sts.amazonaws.com` (no wildcard — no variables) |
| AWS STS (regional)            | `https://sts.{region}.amazonaws.com`                      | `sts.*.amazonaws.com`                            |
| AWS OpenSearch                | `https://search-{domain}.{region}.es.amazonaws.com`       | `*.*.es.amazonaws.com`                           |
| AWS EventBridge Pipes         | `https://pipes.{region}.amazonaws.com`                    | `pipes.*.amazonaws.com`                          |
| AWS Bedrock Runtime           | `https://bedrock-runtime.{region}.amazonaws.com`          | `bedrock-runtime.*.amazonaws.com`                |
| AWS Bedrock Agents            | `https://bedrock-agents-runtime.{region}.amazonaws.com`   | `bedrock-agents-runtime.*.amazonaws.com`         |
| AWS CloudFront (global)       | `https://cloudfront.amazonaws.com`                        | `cloudfront.amazonaws.com` (no variables)        |
| AWS ECR Docker Registry       | `https://{aws_account}.dkr.ecr.{region}.amazonaws.com`    | `*.dkr.ecr.*.amazonaws.com`                      |
| AWS Lambda Invoke URL         | `https://{api-id}.lambda-url.{region}.on.aws`             | `*.lambda-url.*.on.aws`                          |
| AWS CloudTrail                | `https://cloudtrail.{region}.amazonaws.com`               | `cloudtrail.*.amazonaws.com`                     |

### AWS OpenSearch exception

`https://search-{domain}.{region}.es.amazonaws.com` produces `hostShape = *.*.es.amazonaws.com` — two wildcard labels. This is **valid** because `es` is a fixed label before the suffix (`amazonaws.com`), satisfying the "at least one fixed non-suffix label" rule. The validity rule is per-label, not per-count.

### No-variable hosts

When the server URL contains no path-parameter variables in the hostname, `hostShape` equals the raw hostname verbatim (e.g. `sts.amazonaws.com`). The shape derivation still generates the host itself as a candidate — a `terms` query on `hostShape` matches it exactly.

---

## Future Capabilities

The capabilities below are planned but not yet designed in detail. They are recorded here so the architecture accounts for them at design time rather than as retrofits.

### Spec Discovery — Cron-Based Fetch

A scheduled job will periodically attempt to locate or re-fetch an OpenAPI spec for a known API when no spec has been indexed recently or when the current spec has been flagged as stale. This differs from the existing `url_fetch` strategy (see [Version Strategies](./version-strategies#url_fetch)) in that it is triggered automatically by the platform rather than by explicit tenant configuration.

**Triggers (planned):**

- API has not had a new spec version indexed within a configurable threshold
- Three or more consecutive `url_fetch` failures

**Behaviour:** reduces retry cadence (weekly) and surfaces a warning badge in the portal. A tenant can dismiss the warning or manually trigger a re-fetch.

### Spec Discovery — Agentic Web Search

When no spec URL is configured and no spec has been found automatically, the platform will launch an agent that attempts to locate the OpenAPI specification via web search. The agent will:

1. Search for `{api name} openapi.yaml site:{domain}` and similar queries
2. Evaluate candidate URLs for spec validity (parseable, matching host/title)
3. Propose the best candidate to the tenant for confirmation before indexing

This is an optional fallback triggered either manually by the tenant ("Find my spec") or automatically after a configurable idle period. No spec is indexed without tenant confirmation.

### Spec Discovery — Request-Based Credential Polling

For APIs that require authentication to fetch the spec, the platform will support configuring credentials (OAuth client credentials or a static header value) alongside the fetch URL. The `url_fetch` strategy will use these credentials when fetching, without storing them in plaintext — credentials will be referenced by ARN from AWS Secrets Manager.

### OpenAPI Discovery — Spec Generation from Traffic

When no OpenAPI spec is available for an API that is actively receiving traffic through the relay, the platform will be able to generate a draft OpenAPI specification by observing request and response shapes. This is purely additive — the generated spec is stored as a draft, not automatically indexed or used for enrichment until a tenant reviews and approves it.

The generated spec captures: all observed paths and methods, inferred parameter types from path segments, observed request/response content types, and response status codes. It does not capture authentication schemes or request body schemas (those require schema inference from body payloads, which is a separate capability).

### Spec Finder — Domain + Base Path Lookup

A utility endpoint will allow a tenant (or internal tooling) to resolve `(domain, basePath)` → `(apiId, specId)` without going through the full enrichment pipeline. Intended for debugging and for the portal's "which API owns this URL?" diagnostic view.

```
GET /openapi/finder?domain=cloudtrail.ap-southeast-2.amazonaws.com&path=/v1/trails
→ { apiId, specId, matchedHostShape, matchedBasePath }
```

### Operation Finder — Path-Based Lookup

A utility endpoint to resolve a full request `(domain, path, method)` → `operationId` outside the enrichment hot path. Used by the portal's request inspector and for manual enrichment debugging.

```
GET /openapi/finder/operation?domain=...&path=...&method=GET
→ { apiId, specId, operationId, pathKey }
```

---

## Related Documents

- [OpenSearch Indices — Server Index](./opensearch-indices#2-server-index-derrops--tenantid--oaspec--server) — `OaServerDocument` schema
- [OpenSearch Indices — Operation Index](./opensearch-indices#3-operation-index-derrops--tenantid--oaspec--operation) — `OaOperationDocument` schema and `pathKey`
- [Indexing Pipeline — Step 2](./indexing-pipeline#step-2--index-server-documents) — how `hostShape` and `basePath` are populated at index time
- [Search Design — Enrichment Lookup](./search-design#enrichment-lookup-hot-path) — full hot-path sequence with DynamoDB cache
- [OpenAPI Index Access Pattern — Search Modes](./openapi-index-access-pattern#search-modes) — why enrichment uses Global Search
