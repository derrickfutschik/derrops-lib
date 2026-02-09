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

### Singular Naming

Use singular names for modules, folders, files, database tables, and API routes:

- Folder: `service/` not `services/`
- Files: `service.module.ts`, `service.controller.ts`, `service.service.ts`
- Entity: `@Entity('service')` not `@Entity('services')`
- Route: `@Controller('service')` → `/service`
- Class names: `ServiceModule`, `ServiceController`, `ServiceService`

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

### Client Generation

Build generates a TypeScript Axios client from OpenAPI spec:

- Output: `../slaops-portal/src/client/slaops-cloud`
- Uses `openapi-generator-cli`

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
