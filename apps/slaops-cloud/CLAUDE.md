# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SLAOps Cloud is a NestJS backend API for the SLAOps platform. It runs both as a standalone server (development) and as an AWS Lambda function (production).

## Commands

```bash
# Development server with hot reload (port 3001)
pnpm --filter @slaops/cloud run start:dev

# Run unit tests
pnpm --filter @slaops/cloud run test

# Run a single test file
pnpm --filter @slaops/cloud run test -- path/to/file.spec.ts

# Run e2e tests
pnpm --filter @slaops/cloud run test:e2e

# Build (also generates OpenAPI spec and TypeScript client)
pnpm --filter @slaops/cloud run build

# Lint and fix
pnpm --filter @slaops/cloud run lint

# Apply OpenSearch index templates and ingest pipelines (run after adding/changing assets)
pnpm --filter @slaops/cloud run opensearch:migrate:dev
```

## Conventions

### Field Naming Conventions

Field names follow the convention of the layer they belong to:

| Layer | Convention | Example |
|---|---|---|
| TypeScript (classes, interfaces, DTOs) | camelCase | `tenantId`, `createdAt`, `tagsText` |
| SQL columns | snake_case | `tenant_id`, `created_at`, `tags_text` |
| OpenSearch fields | camelCase | `tenantId`, `indexedAt`, `hostShape` |

TypeORM entities use camelCase properties with explicit `@Column({ name: 'snake_case' })` to map to SQL column names. OpenSearch document interfaces use camelCase to match the field names stored in the index.

### Design doc references

Service and controller files that implement a formal design document carry a `@designDoc` tag in their file-level JSDoc block. When editing one of these files, check the linked design doc and update it if the change alters publicly observable behaviour. See `.claude/rules/design-sync.md`.

### Singular Naming

Use singular names for modules, folders, files, database tables, and API routes:

- Folder: `service/` not `services/`
- Files: `service.module.ts`, `service.controller.ts`, `service.service.ts`
- Entity: `@Entity('service')` not `@Entity('services')`
- Route: `@Controller('service')` → `/service`
- Class names: `ServiceModule`, `ServiceController`, `ServiceService`

## Tests

Prefer **object-style assertions** over line-by-line `expect` statements when asserting on a single object or response.

- **Use `toMatchObject`** – Assert the whole shape in one call instead of one `expect` per property. This keeps tests readable and makes the expected structure obvious.
- **Use asymmetric matchers** – For constraints like “any string”, “positive number”, or “non-empty array”, use `expect.any(String)`, `expect.objectContaining({ ... })`, or a custom `{ asymmetricMatch: (value) => ... }` inside the object so everything stays in one assertion.

Example (see `openapi-indexer.integration.test.ts`):

```ts
const positiveNumber = { asymmetricMatch: (n: unknown) => typeof n === 'number' && n > 0 }
const nonEmptyArray = { asymmetricMatch: (a: unknown) => Array.isArray(a) && a.length > 0 }
expect(document).toMatchObject({
  id: API_ID,
  provider: 'ably.net',
  serviceName: 'control',
  version: 'v1',
  title: expect.any(String),
  operationStats: expect.objectContaining({ total: positiveNumber }),
  paths: nonEmptyArray,
})
```

Avoid writing multiple separate lines such as `expect(obj.id).toBe(...)`, `expect(obj.provider).toBe(...)`, etc., when you can express the same in a single `toMatchObject` (or similar) call.

## Architecture

### Entry Points

- `src/main.ts` - Standalone server entry point (development)
- `src/lambda.ts` - AWS Lambda handler with cached server instance
- `src/openapi.ts` - OpenAPI spec generator (runs post-build)

### Module Structure

NestJS modules follow the standard pattern with singular naming:

```
src/
├── app.module.ts              # Root module, configures TypeORM
├── opensearch/                # OpenSearch instance management (see below)
├── openapi-indexer/           # OpenAPI spec indexing
├── openapi-search/            # OpenAPI search API
└── service/                   # Feature module (singular)
    ├── service.module.ts      # Module definition
    ├── service.controller.ts  # REST endpoints
    ├── service.service.ts     # Business logic
    ├── entities/
    │   └── service.entity.ts  # TypeORM entity
    └── dto/
        ├── create-service.dto.ts
        └── update-service.dto.ts
```

### OpenSearch (`src/opensearch/`)

**All OpenSearch instance management lives in this package.** Do not create OpenSearch clients, index templates, or ingest pipelines elsewhere.

- **Ownership** – The opensearch module owns the AWS OpenSearch Serverless client and all index templates and ingest pipelines. Feature modules (e.g. `openapi-search`, `openapi-indexer`) must **import `OpenSearchModule`** and use the exported `Client`, `TypescriptOSProxyClient`, or `OpenSearchService`; they must not instantiate their own clients or define templates/pipelines.
- **Configuration** – Endpoint, index names, template names, and pipeline ids come from `@slaops/config` (e.g. `opensearch.endpoint`, `opensearch.index.*`, `opensearch.template.*`, `opensearch.pipeline.*`). No hardcoded asset names in opensearch code.
- **Definitions** – Index templates live under `resource/indices/`, ingest pipelines under `resource/pipelines/`. Each is registered in the barrel `index.ts` and applied by the migration.
- **Migration** – A single command applies (upserts) all defined templates and pipelines. Run when deploying or when adding/changing assets:

  ```bash
  pnpm --filter @slaops/cloud run opensearch:migrate:dev
  ```

- **Exports** – `OpenSearchModule` provides:
  - `Client` – `@opensearch-project/opensearch` client (AWS SigV4, config-driven endpoint).
  - `TypescriptOSProxyClient` – Typed client from `opensearch-ts`.
  - `OpenSearchService` – Runs migration (template and pipeline upserts).

Adding new index templates or ingest pipelines: add definitions under `resource/indices/` or `resource/pipelines/`, register them in the barrel `index.ts`, and re-run the migrate command. See `src/opensearch/README.md` for details.

### Database

- TypeORM with PostgreSQL (Aurora Serverless in production)
- Entities auto-discovered via `__dirname + '/**/*.entity{.ts,.js}'`
- `synchronize: true` in development, disabled in production
- Lambda uses single connection pool (`max: 1`)
- Credentials from env vars or AWS Secrets Manager (via `DB_SECRET_ARN`)

### OpenAPI Spec Generation

The OpenAPI spec is generated by `src/openapi.ts`, which runs automatically as part of the build step (`nest build && pnpm generate:openapi`). It boots a minimal NestJS app with all controllers (using mock providers) and writes the Swagger document to two locations:

- `src/openapi.json` — committed to source control; used as a reference and for IDE tooling
- `dist/openapi.json` — used by the client generator

To regenerate manually after adding or changing controllers/DTOs:

```bash
# Full build (compiles + generates spec + generates client)
pnpm --filter @slaops/cloud run build

# Spec only (requires a prior compile)
pnpm --filter @slaops/cloud run generate:openapi
```

**Important**: `src/openapi.json` is a generated file. Do not edit it by hand — always regenerate it via the build.

**Quick reference**: The committed spec is at `apps/slaops-cloud/src/openapi.json` — read this file to understand the current API surface (endpoints, request/response shapes, DTOs) without running the server.

### Client Generation

Build generates a TypeScript Axios client from OpenAPI spec:

- Output: `../slaops-portal/src/client/slaops-cloud`
- Uses `openapi-generator-cli`
- Runs automatically after spec generation as part of `pnpm --filter @slaops/cloud run build`

To regenerate the client only (requires `dist/openapi.json` to exist):

```bash
pnpm --filter @slaops/cloud run generate:client
```

## Configuration

Environment variables loaded from monorepo root `.env` file via `dotenv-cli`.

Key variables:

- `PORT` - Server port (default: 3001)
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` - Database connection
- `DB_SECRET_ARN` - AWS Secrets Manager ARN (Lambda only)
- `CORS_ORIGIN` - Allowed CORS origin
- OpenSearch: use `@slaops/config` keys (e.g. `opensearch.endpoint`, `opensearch.index.*`, `opensearch.template.*`, `opensearch.pipeline.*`); see `packages/slaops-config`

## API

- Swagger UI: `/api`
- OpenAPI JSON: `/api-json`
- All service endpoints prefixed with `/service` (singular)
- Supports `?select=field1,field2` query parameter for field selection (Supabase-compatible)
