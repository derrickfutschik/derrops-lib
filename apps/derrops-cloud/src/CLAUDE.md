# OpenSearch — Type-safe access rules

## Always use `TypescriptOSProxyClient.searchTS<T>()` for reads

The `TypescriptOSProxyClient` (from `opensearch-ts`) wraps the raw `Client` and provides a fully typed `searchTS<T>()` method. Use it for all search and count operations so that `_source` is typed as `T` and hit mapping is type-checked at compile time.

```typescript
// ✅ Correct — _source is typed as OaSpecDocument
const response = await this.tsClient.searchTS<OaSpecDocument, Record<string, never>>({
  body: { query: { match_all: {} }, size: 10 },
  index: 'derrops--dev--t-glbl0000--oaspec--spec',
})
const hits = response.hits.hits.map((h) => h._source.title) // string ✓

// ❌ Wrong — _source is any, errors are silent
const response = await this.opensearchClient.search({ index, body })
const hits = response.body.hits.hits.map((h: any) => h._source.title)
```

## Define document interfaces for every index

Every OpenSearch index used in this app must have a corresponding TypeScript interface. Place these interfaces alongside the module that owns the index:

- `openapi-indexer/oaspec-documents.ts` — `OaSpecDocument`, `OaServerDocument`, `OaOperationDocument`, `OaParamDocument`, `OaModelDocument`
- `openapi-search/types/openapi-index.types.ts` — `OpenApiIndexDocument` (legacy index)

Never use `any[]` as the return type of a method that maps OpenSearch hits. Define and export a concrete hit type.

## Use the raw `Client` only for writes

`TypescriptOSProxyClient` only wraps read operations (`searchTS`, `msearchTS`, `countTs`). Write operations — `index`, `bulk`, `updateByQuery`, `deleteByQuery` — must still go through the raw `Client`. Type the document bodies explicitly using the interfaces above before passing them to the raw client:

```typescript
const doc: OaSpecDocument = { id, apiId, ... }
await this.opensearchClient.index({ index: '...', id: doc.id, body: doc, refresh: true })
```

## `TypescriptOSProxyClient` injection

Both `Client` and `TypescriptOSProxyClient` are provided and exported by `OpenSearchModule`. Inject both in services that need reads and writes:

```typescript
constructor(
  private readonly opensearchClient: Client,         // writes
  private readonly tsClient: TypescriptOSProxyClient, // reads
) {}
```

Do not instantiate either directly — always inject via NestJS DI.
