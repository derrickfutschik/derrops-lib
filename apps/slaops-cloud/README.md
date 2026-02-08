# @slaops/cloud

NestJS backend API for the SLAOps platform.

## Features

- RESTful API for service management
- TypeORM with PostgreSQL (Aurora Serverless)
- Swagger/OpenAPI documentation
- Input validation with class-validator
- CORS support for frontend integration

## Quick Start

### Prerequisites

- Node.js >= 22.0.0
- PostgreSQL database (local or AWS RDS Aurora Serverless)
- pnpm 8.15.4+

### Installation

```bash
# From monorepo root
pnpm install

# Install dependencies for this app only
pnpm --filter @slaops/cloud install
```

### Configuration

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Update database credentials in `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=postgres
   DB_NAME=slaops
   ```

### Running the App

```bash
# Development mode with hot reload
pnpm --filter @slaops/cloud run start:dev

# Production mode
pnpm --filter @slaops/cloud run start:prod
```

### OpenAPI Spec and Client Generation

```bash
pnpm --filter @slaops/cloud run generate:openapi
```

Will generate the OpenAPI spec in `dist/openapi.json` and `src/openapi.json`

```bash
pnpm --filter @slaops/cloud run generate:client
```

Will generate the client in `<root>/apps/slaops-portal/src/client/slaops-cloud` for use the slaops-portal app to type-safely interact with the slaops-cloud API.

## Development

### Building

```bash
pnpm --filter @slaops/cloud run build
```

### Testing

```bash
# Unit tests
pnpm --filter @slaops/cloud run test

# Watch mode
pnpm --filter @slaops/cloud run test:watch

# Coverage
pnpm --filter @slaops/cloud run test:cov
```

### Linting

```bash
pnpm --filter @slaops/cloud run lint
```

## Deployment

### AWS Infrastructure

The database infrastructure (Aurora Serverless PostgreSQL) is defined in `packages/slaops-backend/` using AWS Amplify Gen 2.

See [packages/slaops-backend/README.md](../../packages/slaops-backend/README.md) for infrastructure setup.

### Environment Variables for Production

```env
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://portal.slaops.com

DB_HOST=your-rds-instance.region.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=your-secure-password
DB_NAME=slaops
DB_SSL=true
DB_LOGGING=false
```

## API Documentation

Once the server is running, visit `http://localhost:3001/api` to access the interactive Swagger documentation.

## Compatibility with Supabase

This API is designed to be compatible with the previous Supabase implementation:

- Query parameter `select` works similarly to Supabase's select
- Response format matches Supabase's JSON structure
- Field names match the Supabase schema

Example migration:

```typescript
// Before (Supabase)
const { data, error } = await supabase
  .from('services')
  .select('id, name, endpoint, openapi_doc_url, openapi_doc_content');

// After (NestJS API)
const response = await fetch(
  'http://localhost:3001/service?select=id,name,endpoint,openapi_doc_url,openapi_doc_content',
);
const data = await response.json();
```
