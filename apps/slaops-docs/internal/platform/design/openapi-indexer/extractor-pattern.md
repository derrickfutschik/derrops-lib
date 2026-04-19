---
id: extractor-pattern
title: Extractor Pattern
sidebar_label: Extractor Pattern
sidebar_position: 11
created_at: 2026-04-19
updated_at: 2026-04-19
implemented_at: ~
author: Derrick
status: draft
tags:
  - openapi-indexer
  - data-pipeline
  - component-design
  - oaspec
---

# Extractor Pattern

This document defines the common extraction pattern used by the `openapi-indexer` service. Each of the five OpenSearch entity types (`spec`, `server`, `operation`, `param`, `model`) is handled by a dedicated extractor class that implements a shared interface. The indexer runs all five extractors in sequence, writes their output to the corresponding index, and returns one `ExtractionState` per entity type.

---

## Motivation

The [Indexing Pipeline](./indexing-pipeline) runs five OpenSearch write steps in sequence. Without a shared pattern, each step becomes ad-hoc — different return shapes, different error handling, different truncation logic. The extractor pattern gives every entity type:

- A uniform input contract (`ExtractionContext`)
- A pure, synchronous extraction phase (no I/O)
- A uniform output contract (`ExtractionResult<TDoc>`)
- A uniform per-entity state summary (`ExtractionState`)
- A single aggregated `ExtractionState[]` from the indexer run

---

## Types

### `OaspecEntity`

```typescript
type OaspecEntity = 'spec' | 'server' | 'operation' | 'param' | 'model'
```

### `ExtractionContext`

The immutable context passed to every extractor. Built once before any extractor runs and shared across all five.

```typescript
interface ExtractionContext {
  tenantId: string
  apiId: string
  specId: string       // deterministic: SHA256_16(tenantId, info.title, info.version)
  version: string      // info.version from the spec
  spec: ResolvedOpenApiSpec  // fully $ref-resolved spec object
}
```

`specId` is computed from the resolved spec before any extractor is called (see [Pre-computation of `specId`](#pre-computation-of-specid)). All downstream extractors receive it as part of context — they do not need to derive it themselves.

### `ExtractionResult<TDoc>`

Returned by the synchronous `extract` method on every extractor. Contains the documents to write and any extraction-time observations.

```typescript
interface ExtractionResult<TDoc> {
  documents: TDoc[]
  truncated: boolean    // true if document count hit the per-entity limit
  warnings: string[]    // non-fatal issues encountered during extraction (logged, not thrown)
}
```

### `ExtractionState`

One entry per entity type in the array returned by the indexer run. Records what happened at every stage: extraction, indexing, and pruning.

```typescript
interface ExtractionState {
  entity: OaspecEntity
  extracted: number    // documents produced by the extractor
  indexed: number      // documents successfully written to OpenSearch
  pruned: number       // old-version docs deleted from this index
  truncated: boolean   // extraction hit the per-entity document limit
  errors: ExtractionError[]
}

interface ExtractionError {
  phase: 'extract' | 'index' | 'prune'
  message: string
}
```

The indexer returns `ExtractionState[]` — always five entries, one per entity, in pipeline order:

```typescript
type IndexingResult = ExtractionState[]
// [specState, serverState, operationState, paramState, modelState]
```

---

## `ISpecExtractor<TDoc>` Interface

```typescript
interface ISpecExtractor<TDoc> {
  readonly entity: OaspecEntity
  extract(context: ExtractionContext): ExtractionResult<TDoc>
}
```

The `extract` method is **pure and synchronous** — it takes the resolved spec and context, returns documents, and performs no I/O. All OpenSearch writes are the pipeline's responsibility, not the extractor's. This keeps extractors independently testable.

### Concrete extractor classes

| Class | Entity | Target index |
|---|---|---|
| `SpecExtractor` | `spec` | `…--oaspec--spec` |
| `ServerExtractor` | `server` | `…--oaspec--server` |
| `OperationExtractor` | `operation` | `…--oaspec--operation` |
| `ParamExtractor` | `param` | `…--oaspec--param` |
| `ModelExtractor` | `model` | `…--oaspec--model` |

Each class is responsible only for producing documents of its type. Field-level extraction rules for each are defined in [Spec Field Extraction](./spec-field-extraction).

---

## Pipeline Integration

The indexer calls each extractor in sequence. For each entity type the pipeline:

1. Calls `extractor.extract(context)` → `ExtractionResult<TDoc>`
2. Updates `latest: false` on the single current-latest document(s) for `apiId` in the target index
3. Bulk-writes `result.documents` with `latest: true`
4. Prunes versions outside the retention window
5. Records counts and errors into `ExtractionState`

```typescript
async function runPipeline(context: ExtractionContext): Promise<ExtractionState[]> {
  const states: ExtractionState[] = []

  for (const extractor of EXTRACTORS) {
    const state = await runExtractor(extractor, context)
    states.push(state)
  }

  return states
}
```

`EXTRACTORS` is the ordered array `[SpecExtractor, ServerExtractor, OperationExtractor, ParamExtractor, ModelExtractor]`.

### `runExtractor` outline

```typescript
async function runExtractor<TDoc>(
  extractor: ISpecExtractor<TDoc>,
  context: ExtractionContext,
): Promise<ExtractionState> {
  const state: ExtractionState = {
    entity: extractor.entity,
    extracted: 0,
    indexed: 0,
    pruned: 0,
    truncated: false,
    errors: [],
  }

  // 1. Extract (synchronous, no I/O)
  let result: ExtractionResult<TDoc>
  try {
    result = extractor.extract(context)
    state.extracted = result.documents.length
    state.truncated = result.truncated
  } catch (err) {
    state.errors.push({ phase: 'extract', message: String(err) })
    return state  // no documents to index — skip remaining phases
  }

  // 2. Flip latest flag + bulk index
  try {
    await flipLatestFlag(extractor.entity, context)
    await bulkIndex(extractor.entity, context.tenantId, result.documents)
    state.indexed = result.documents.length
  } catch (err) {
    state.errors.push({ phase: 'index', message: String(err) })
  }

  // 3. Prune old versions
  try {
    state.pruned = await pruneVersions(extractor.entity, context)
  } catch (err) {
    state.errors.push({ phase: 'prune', message: String(err) })
  }

  return state
}
```

A failure in any phase is **non-fatal to the pipeline** — the error is recorded in `state.errors` and the next extractor runs. The exception is an extraction-phase failure: if `extract()` throws, there are no documents to index and the index/prune phases are skipped for that entity.

---

## Pre-computation of `specId`

`specId` is the ID of the `OaSpecDocument` that will be written by `SpecExtractor`. It is also used as `specId` on every server, operation, parameter, and model document. Rather than extracting spec documents first and then passing the resulting ID forward, `specId` is computed deterministically from the resolved spec before any extractor runs:

```typescript
function buildContext(
  tenantId: string,
  apiId: string,
  spec: ResolvedOpenApiSpec,
): ExtractionContext {
  const version = spec.info.version
  const specId = sha256_16(tenantId, spec.info.title, version)
  return { tenantId, apiId, specId, version, spec }
}
```

This avoids a sequencing dependency: all five extractors receive a fully-populated context and can run independently if needed (e.g. during testing).

---

## Cross-Index ID References

Operation documents reference parameter documents via `parameterIdsText`, and parameter documents reference operation documents via `operationIdsText`. Both document types reference each other — but because all IDs are deterministic SHA256 hashes of stable spec fields, neither extractor needs the output of the other:

- `OperationExtractor` computes parameter IDs using the same `sha256_16(tenantId, title, version, name, location)` formula that `ParamExtractor` uses for `id`.
- `ParamExtractor` computes operation IDs using the same `sha256_16(tenantId, title, version, method, path)` formula that `OperationExtractor` uses for `id`.

Both compute the same IDs independently from the resolved spec. There is no actual circular dependency.

---

## Truncation

Each entity type has a configured per-run document limit. When the extractor produces more documents than the limit, it returns the first N and sets `truncated: true`.

```typescript
// config.ts
'opensearch.oaspec.max-operations-per-spec': 2000,
'opensearch.oaspec.max-params-per-spec': 5000,
'opensearch.oaspec.max-models-per-spec': 1000,
```

`spec` and `server` documents are never truncated (a spec has exactly one spec document; server counts are small). `operation`, `param`, and `model` use the configured limits.

The `truncated` flag propagates from `ExtractionResult` → `ExtractionState` → `IndexingResult`. The portal warns the user when a spec was truncated, and the spec document in OpenSearch also carries `truncated: true` for the affected entity types.

---

## Testing

Because `extract()` is pure and synchronous, each extractor can be unit tested directly:

```typescript
const context = buildContext('t-acme0001', 'api-uuid', resolvedSpec)
const result = new OperationExtractor().extract(context)

expect(result.documents).toHaveLength(3)
expect(result.documents[0].method).toBe('GET')
expect(result.truncated).toBe(false)
```

No OpenSearch mocks, no async setup. Pipeline-level integration tests cover the index/prune phases.

---

## Related Documents

- [Spec Field Extraction](./spec-field-extraction) — per-field extraction rules for each extractor
- [Indexing Pipeline](./indexing-pipeline) — the six-step pipeline that drives the extractor sequence
- [OpenSearch Indices](./opensearch-indices) — document schemas each extractor produces
- [API Data Model](./api-oaspec-data-model) — ID generation (`sha256_16`) used by all extractors
