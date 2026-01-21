# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SLAOps Cloud is a NestJS backend API for the SLAOps platform. It runs both as a standalone server (development) and as an AWS Lambda function (production).

## Commands

```bash
# Development server with hot reload (port 3001)
pnpm --filter slaops-cloud run start:dev

# Run unit tests
pnpm --filter slaops-cloud run test

# Run a single test file
pnpm --filter slaops-cloud run test -- path/to/file.spec.ts

# Run e2e tests
pnpm --filter slaops-cloud run test:e2e

# Build (also generates OpenAPI spec and TypeScript client)
pnpm --filter slaops-cloud run build

# Lint and fix
pnpm --filter slaops-cloud run lint
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

## API

- Swagger UI: `/api`
- OpenAPI JSON: `/api-json`
- All service endpoints prefixed with `/service` (singular)
- Supports `?select=field1,field2` query parameter for field selection (Supabase-compatible)
