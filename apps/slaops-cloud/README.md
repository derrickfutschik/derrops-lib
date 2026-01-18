# SLAOps Cloud Backend

NestJS backend API for the SLAOps platform, replacing Supabase with a custom backend.

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
pnpm --filter slaops-cloud install
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
pnpm --filter slaops-cloud run start:dev

# Production mode
pnpm --filter slaops-cloud run start:prod
```

The API will be available at:
- API: `http://localhost:3001`
- Swagger docs: `http://localhost:3001/api`

## API Endpoints

### Services

All endpoints are prefixed with `/service`

#### Create Service
```http
POST /service
Content-Type: application/json

{
  "user_id": "5c963787-d89d-4260-adaf-6541c41cb982",
  "name": "SendGrid API",
  "endpoint": "https://api.sendgrid.com/v3",
  "openapi_doc_url": "https://raw.githubusercontent.com/sendgrid/sendgrid-oai/main/oai.json",
  "openapi_doc_content": null,
  "availability": 99.98,
  "response_time": 80
}
```

#### Get All Services
```http
GET /service
GET /service?select=id,name,endpoint,openapi_doc_url,openapi_doc_content
```

The `select` query parameter allows you to specify which fields to return (comma-separated).

#### Get Service by ID
```http
GET /service/:id
GET /service/:id?select=id,name,endpoint
```

#### Update Service
```http
PATCH /service/:id
Content-Type: application/json

{
  "name": "Updated Service Name",
  "availability": 99.99
}
```

#### Delete Service
```http
DELETE /service/:id
```

## Database Schema

### Service Table

```sql
CREATE TABLE service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  openapi_doc_url VARCHAR(500),
  openapi_doc_content TEXT,
  availability DECIMAL(5,2),
  response_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Development

### Building

```bash
pnpm --filter slaops-cloud run build
```

### Testing

```bash
# Unit tests
pnpm --filter slaops-cloud run test

# Watch mode
pnpm --filter slaops-cloud run test:watch

# Coverage
pnpm --filter slaops-cloud run test:cov
```

### Linting

```bash
pnpm --filter slaops-cloud run lint
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
  .from("services")
  .select("id, name, endpoint, openapi_doc_url, openapi_doc_content");

// After (NestJS API)
const response = await fetch('http://localhost:3001/service?select=id,name,endpoint,openapi_doc_url,openapi_doc_content');
const data = await response.json();
```

## License

MIT
