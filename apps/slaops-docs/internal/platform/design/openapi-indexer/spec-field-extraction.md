---
id: spec-field-extraction
title: Spec Field Extraction & Transformation
sidebar_label: Spec Field Extraction
sidebar_position: 10
created_at: 2026-04-19
updated_at: 2026-04-19
implemented_at: ~
author: Derrick
status: draft
tags:
  - openapi-indexer
  - data-pipeline
  - oaspec
---

# Spec Field Extraction & Transformation

This document defines how each section of a raw OpenAPI spec (YAML or JSON) is parsed, transformed, and mapped to the five OpenSearch index document types described in [OpenSearch Indices](./opensearch-indices). It is the transformation reference for [Indexing Pipeline](./indexing-pipeline) steps 1–5.

---

## Spec Structure → Index Entity Mapping

A single OpenAPI document produces documents for all five indices. The table below shows which part of the spec feeds each index:

| Spec section | Entity produced | Index |
|---|---|---|
| `info`, `tags`, `externalDocs` | One `OaSpecDocument` | `…--oaspec--spec` |
| `servers[]` | One `OaServerDocument` per entry | `…--oaspec--server` |
| `paths.{path}.{method}` | One `OaOperationDocument` per method | `…--oaspec--operation` |
| `paths.{path}.{method}.parameters[]` + `components.parameters` | One `OaParamDocument` per unique parameter | `…--oaspec--param` |
| `components.schemas` + inline request/response bodies | One `OaModelDocument` per schema | `…--oaspec--model` |

All `$ref` pointers are fully resolved before extraction begins. See [$ref Resolution](#ref-resolution) below.

---

## 1. Spec Document Extraction

**Source:** top-level `info`, `tags[]`, `externalDocs`, `openapi` fields.

| Index field | Source expression | Notes |
|---|---|---|
| `title` | `info.title` | Required by OAS; never absent |
| `description` | `info.description` | `""` if absent |
| `version` | `info.version` | Required by OAS |
| `specVersion` | `openapi` | e.g. `"3.1.0"` |
| `termsOfService` | `info.termsOfService` | `undefined` if absent |
| `contactText` | `info.contact` | See [Contact serialisation](#contact-serialisation) |
| `licenseText` | `info.license` | See [License serialisation](#license-serialisation) |
| `externalDocsText` | `externalDocs` | See [ExternalDocs serialisation](#externaldocs-serialisation) |
| `tagsText` | `tags[].name` | Space-separated; `""` if `tags` absent |
| `operationCount` | counted during path walk | Total HTTP operations across all paths |
| `serverCount` | `servers.length` | 0 if `servers` absent |
| `parameterCount` | counted during parameter collection | Unique params after deduplication |
| `modelCount` | counted during schema collection | Schemas in `components.schemas` + named inline bodies |
| `s3Bucket`, `s3Key` | from pipeline request | Passed in by the `POST /openapi/index` caller |
| `fileSize`, `fileFormat` | from pipeline request | Provided by the upload step |

### Contact serialisation

`info.contact` is flattened to a single text field:

```
{name?} {email?} {url?}
```

Parts are space-joined, omitting absent fields. Example:

```yaml
# Spec
info:
  contact:
    name: Stripe Support
    email: support@stripe.com
    url: https://stripe.com/support
```

```
contactText: "Stripe Support support@stripe.com https://stripe.com/support"
```

### License serialisation

```
{name} {url?}
```

Example: `"MIT https://opensource.org/licenses/MIT"`

### ExternalDocs serialisation

```
{description?} {url}
```

Example: `"API Reference https://docs.stripe.com/api"`

---

## 2. Server Document Extraction

**Source:** `servers[]` at the spec root. Each entry produces one document.

| Index field | Source / derivation |
|---|---|
| `rawUrl` | `server.url` verbatim |
| `description` | `server.description` |
| `serverIndex` | Position in `servers` array (0-based) |
| `scheme` | Parsed from `rawUrl`: everything before `://` |
| `hostTemplate` | Parsed from `rawUrl`: hostname including `{variable}` placeholders |
| `hostShape` | `hostTemplate` with every `{variable}` replaced by `*` |
| `dnsSuffix` | Public suffix + one registrable label extracted from `hostTemplate` |
| `fixedLabelsText` | Space-joined fixed (non-variable) subdomain labels |
| `varLabelsText` | Space-joined variable names (without braces) |
| `basePath` | Path component of `rawUrl`, defaulting to `"/"` |
| `variablesText` | `server.variables` serialised; see below |

### Host shape derivation

Given: `https://cloudtrail.{region}.amazonaws.com`

1. Strip scheme → `cloudtrail.{region}.amazonaws.com`
2. Identify `{variable}` placeholders → variables: `[region]`
3. Replace each `{variable}` with `*` → `cloudtrail.*.amazonaws.com`
4. Extract `dnsSuffix` = `amazonaws.com` (public suffix `com` + one label `amazonaws`)
5. `fixedLabelsText` = `"cloudtrail"` (fixed subdomain labels)
6. `varLabelsText` = `"region"` (variable names)

For a spec without path variables: `https://api.example.com/v2`

- `hostTemplate` = `api.example.com`
- `hostShape` = `api.example.com` (no substitution needed)
- `basePath` = `"/v2"`

### Variables text serialisation

Each entry in `server.variables` is serialised as `{name}:{default}`, joined with spaces:

```yaml
# Spec
servers:
  - url: "https://{env}.api.example.com"
    variables:
      env:
        default: prod
        enum: [prod, staging]
```

```
variablesText: "env:prod"
```

The `enum` values are not indexed — only the `default` is stored.

---

## 3. Operation Document Extraction

**Source:** `paths[path][method]` for each HTTP method present under each path item.

Recognised methods: `get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `trace`.

| Index field | Source / derivation |
|---|---|
| `method` | HTTP method uppercased: `"GET"`, `"POST"`, etc. |
| `path` | Path string as-is, e.g. `"/users/{userId}/orders"` |
| `operationId` | `operation.operationId` |
| `summary` | `operation.summary` |
| `description` | `operation.description` |
| `deprecated` | `operation.deprecated ?? false` |
| `tagsText` | `operation.tags.join(" ")`, `""` if absent |
| `pathKey` | Compacted path key; see [Path key compaction](#path-key-compaction) |
| `parameterIdsText` | Space-joined IDs of `OaParamDocument`s referenced by this operation |
| `requestModelId` | ID of the `OaModelDocument` for the request body schema (single model) |
| `responseModelIdsText` | Space-joined IDs of `OaModelDocument`s for all response schemas |

### Path parameters from path items

A `pathItem` may define parameters that apply to all operations under that path. These are merged with the operation-level parameters before extraction, with operation-level taking precedence for same-named parameters.

### Path key compaction

`pathKey` is used during log enrichment to quickly match an incoming `method + path` to an operation. Format:

```
{methodInitial}:{compactedPath}
```

**Method initials:**

| Method | Initial |
|---|---|
| `GET` | `G` |
| `POST` | `P` |
| `PUT` | `U` |
| `DELETE` | `D` |
| `PATCH` | `A` |
| `HEAD` | `H` |
| `OPTIONS` | `O` |
| `TRACE` | `T` |

**Path compaction rules:**

Path parameters are replaced based on their schema type:

| Schema type | Replacement |
|---|---|
| `integer` or `number` | `{i}` |
| `string` (or untyped) | `{s}` |

Example:

```
path: /users/{userId}/orders/{orderId}
# userId: string, orderId: integer

pathKey: "G:{s}/orders/{i}"
```

The static path segments are preserved verbatim. Only parameter placeholders are compressed.

---

## 4. Parameter Document Extraction

**Source:** `components.parameters` (shared) and `paths[path][method].parameters[]` (per-operation).

Parameters are deduplicated across operations: a shared parameter referenced via `$ref` from multiple operations produces a single `OaParamDocument` with all referencing operation IDs listed in `operationIdsText`.

| Index field | Source / derivation |
|---|---|
| `name` | `parameter.name` |
| `location` | `parameter.in` renamed to `location` (`"path"`, `"query"`, `"header"`, `"cookie"`) |
| `required` | `parameter.required ?? (location === "path" ? true : false)` |
| `deprecated` | `parameter.deprecated ?? false` |
| `description` | `parameter.description` |
| `schemaType` | `parameter.schema.type` |
| `schemaFormat` | `parameter.schema.format` |
| `exampleText` | See [Example serialisation](#example-serialisation) |
| `operationIdsText` | Space-joined IDs of all `OaOperationDocument`s that reference this parameter |

### Deduplication key

A parameter is considered the same parameter if it shares the same `(specId, name, location)` triple. If two operations define inline (non-`$ref`) parameters with identical `name` and `location`, they are merged into one document.

### Example serialisation

`parameter.example` (any type) is serialised to a JSON string stored in `exampleText`:

```yaml
example: 42            →  exampleText: "42"
example: "abc"         →  exampleText: "abc"
example: {a: 1}        →  exampleText: "{\"a\":1}"
```

`examples` (the plural map) is not indexed — only `example` is captured.

---

## 5. Model Document Extraction

**Source:** `components.schemas` and inline request/response body schemas.

### Named schemas (`components.schemas`)

Each key in `components.schemas` produces one `OaModelDocument`. The document `name` is the schema key.

### Inline body schemas

Request body schemas (`requestBody.content["application/json"].schema`) and response body schemas (`responses[statusCode].content["application/json"].schema`) that are not `$ref` pointers to a named component are assigned a derived name:

```
{operationId}_{direction}_{statusCode?}
```

Examples:
- Request body for `createOrder` → `createOrder_request`
- `200` response for `createOrder` → `createOrder_response_200`
- `default` response → `createOrder_response_default`

Inline schemas that resolve to a `$ref` are not given their own document; the referenced named schema is used instead.

### Field extraction

| Index field | Source / derivation |
|---|---|
| `name` | `components.schemas` key or derived name |
| `description` | `schema.description` |
| `schemaType` | `schema.type` (top-level type of the schema) |
| `propertiesText` | Properties serialised to text; see below |
| `operationIdsText` | Space-joined IDs of operations that reference this model |
| `usedInText` | `"request"`, `"response"`, or `"request response"` |

### Properties text serialisation

Each property in `schema.properties` produces one line in `propertiesText`:

```
{name} {type} {format?} - {description?}
```

Properties are newline-joined. Only top-level properties are extracted — nested object properties are not recursed.

Example schema:

```yaml
Payment:
  type: object
  properties:
    id:
      type: string
      format: uuid
      description: Unique payment identifier
    amount:
      type: integer
      description: Total in minor units
    currency:
      type: string
```

Produces:

```
id string uuid - Unique payment identifier
amount integer  - Total in minor units
currency string
```

For `array` schemas without a `properties` map (e.g. an array of strings), `propertiesText` captures the `items` type:

```
items {type} {format?}
```

For schemas of type `string`, `integer`, `boolean`, etc. (scalar types with no properties), `propertiesText` is `""`.

---

## $ref Resolution

All `$ref` pointers are resolved to their target objects before any field extraction begins. The resolver:

1. Builds a complete in-memory map of all `components/*` entries.
2. Traverses the spec and replaces every `$ref` with its resolved value.
3. Detects circular references (e.g. a schema that references itself via `allOf`) and breaks the cycle — the circular reference is replaced with a minimal stub `{ type: "object" }`.

After resolution, the extraction steps operate on a `$ref`-free spec object. No extraction step needs to follow references.

---

## Handling Missing and Optional Fields

Extraction never throws on a missing optional field. The rules:

| Situation | Behaviour |
|---|---|
| Text field absent | Store `""` (empty string), not `null` |
| Boolean field absent | Apply the OAS default (`false` for `deprecated`, etc.) |
| `servers` absent | Produce zero server documents; `serverCount: 0` on spec document |
| `components.schemas` absent | Produce zero model documents |
| `paths` absent | Produce zero operation and parameter documents |
| `info.contact` / `info.license` absent | Corresponding `*Text` field is `undefined` (omitted from document) |

---

## Related Documents

- [OpenSearch Indices](./opensearch-indices) — document schemas for each of the five indices
- [Indexing Pipeline](./indexing-pipeline) — the six-step pipeline that calls this extraction logic
- [API Data Model](./api-oaspec-data-model) — ID generation for all document types
- [API Matching Algorithm](./api-matching) — how `hostShape` and `pathKey` are used during enrichment
