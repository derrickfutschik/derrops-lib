# OpenAPI Indexer

NestJS module that indexes OpenAPI 3.x specifications from S3 into OpenSearch. Used by the SLAOps platform to make API specs searchable (e.g. for the OpenAPI Directory).

## Overview

- **S3 events**: When OpenAPI files are created, updated, or removed in a configured S3 bucket, the indexer is invoked (via Lambda).
- **Parsing**: YAML/JSON specs are parsed, validated as OpenAPI 3.x, and transformed into a fixed index document shape.
- **OpenSearch**: Documents are written to an OpenSearch index (AWS OpenSearch Serverless) for search and discovery.

Document IDs follow the S3 path: `{provider}/{service}/{version}` (e.g. `github.com/api.github.com/1.1.4`).

## Module structure

| File                         | Purpose                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `openapi-indexer.module.ts`  | NestJS module; registers and exports the two services.                         |
| `openapi-indexer.service.ts` | S3 fetch, path validation, document ID extraction, index/delete in OpenSearch. |
| `openapi-parser.service.ts`  | Parse YAML/JSON, validate OpenAPI 3.x, build `OpenApiIndexDocument`.           |
| `index.ts`                   | Re-exports module and services.                                                |

## Lambda entry point

The indexer is invoked by the **indexer Lambda** (`indexer-lambda.ts`), which:

1. Receives an S3 event (one or more object create/remove notifications).
2. Bootstraps a minimal NestJS app that imports `OpenApiIndexerModule`.
3. For each S3 record, calls `OpenApiIndexerService.processRecord(record)`.
4. Returns an array of `IndexResult` (success/failure, counts, duration).

S3 record shape expected by `processRecord`:

- `bucket`: S3 bucket name
- `key`: Object key (e.g. `APIs/github.com/api.github.com/1.1.4/openapi.yaml`)
- `eventName`: e.g. `ObjectCreated:Put`, `ObjectRemoved:Delete`

## S3 key convention

Only keys matching this pattern are indexed (others are skipped without error):

- `APIs/{provider}/{service}/{version}/openapi.{yaml|yml|json}`
- or `APIs/{provider}/{service}/{version}/swagger.{yaml|yml|json}`

Document ID is `{provider}/{service}/{version}`.

## Index document shape

The stored document type is `OpenApiIndexDocument` (see `openapi-search/types/openapi-index.types.ts`). It includes:

- **Identity**: `id`, `provider`, `serviceName`, `version`, `specVersion`
- **Info**: `title`, `description`, `termsOfService`, `contact`, `license`
- **Structure**: `servers`, `tags`, `paths` (truncated to limits), `operationStats`, `sampleOperations`, `operationSearchText`
- **Location**: `s3Location` (bucket + key)
- **Metadata**: `indexedAt`, `updatedAt`, `fileSize`, `fileFormat`

Dimensionality is capped via `INDEXING_LIMITS` (e.g. max paths, sample operations, operation IDs, search text length, file size).

## Configuration

- **OpenSearch**: Uses `@slaops-config/config` — index name from `config['opensearch.index.openapis']`; endpoint and region from `config['aws.accountId']` and `config['aws.region']`. AWS SigV4 is used for OpenSearch Serverless (`aoss`). If the endpoint is not set, indexing is skipped (warning logged).
- **Debug**: Set `DEBUG=true` (e.g. in Lambda env) for extra logging (e.g. skipped non-OpenAPI keys).

## Error handling

- **Parse/validation errors**: Invalid YAML/JSON or non–OpenAPI 3.x specs throw `IndexingError` with a `IndexingErrorCode` (e.g. `PARSE_ERROR`, `NOT_OPENAPI_3`, `FILE_TOO_LARGE`, `INVALID_PATH`). The Lambda reports these in `IndexResult.error` and `success: false`.
- **S3**: Empty or failed GetObject results in `IndexingError` with `S3_ERROR`.
- **OpenSearch**: Index/delete failures are propagated; 404 on delete is ignored.

## Usage outside Lambda

Import `OpenApiIndexerModule` into any NestJS app, then inject `OpenApiIndexerService` and/or `OpenApiParserService`. Use `processRecord()` for the full S3→index flow, or use the parser and indexer methods separately (e.g. fetch from S3 yourself, then `parserService.parseAndTransform()` and `indexerService.indexDocument()`).
