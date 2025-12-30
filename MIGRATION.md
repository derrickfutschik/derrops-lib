# Migration from Supabase to SLAOps Cloud Backend

This document describes the migration from Supabase to the custom NestJS backend.

## Overview

The SLAOps platform has been migrated from using Supabase as the backend to a custom NestJS backend (`apps/slaops-cloud`) with AWS Aurora Serverless PostgreSQL.

## What Changed

### New Backend Application

**Location**: `apps/slaops-cloud/`

A new NestJS application has been created with:
- RESTful API for services management
- TypeORM with PostgreSQL support
- Swagger/OpenAPI documentation
- Supabase-compatible API interface

**Key Features**:
- Services CRUD operations
- Query parameter support for field selection
- Validation with class-validator
- CORS enabled for frontend integration

### Database Infrastructure

**Location**: `packages/slaops-backend/amplify/database/`

AWS infrastructure has been added:
- Aurora Serverless v2 PostgreSQL cluster
- VPC with public, private, and isolated subnets
- Security groups and access controls
- Bastion host for secure database access
- Secrets Manager for credentials

**Database Schema**:
```sql
CREATE TABLE services (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  openapi_doc_url VARCHAR(500),
  openapi_doc_content TEXT,
  availability DECIMAL(5,2),
  response_time INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### API Client Library

**Location**: `apps/slaops-portal/src/lib/api/`

A new API client library has been created that mimics the Supabase API:

```typescript
// Old (Supabase)
const { data, error } = await supabase
  .from("services")
  .select("id, name, endpoint")
  .order("created_at", { ascending: false });

// New (SLAOps Cloud API)
const { data, error } = await api
  .from("services")
  .select("id,name,endpoint")
  .order("created_at", { ascending: false });
```

The API maintains the same response format: `{ data, error }`

### Portal Updates

**Updated Files**:
- `apps/slaops-portal/src/components/dashboard/ServicesList.tsx`
- `apps/slaops-portal/src/pages/AddService.tsx`
- `apps/slaops-portal/src/pages/ServiceDetails.tsx`

**Changes**:
- Replaced `supabase` imports with `api` or `servicesApi` from `@/lib/api`
- Updated authentication to use hardcoded user_id (temporary, pending Cognito integration)
- Maintained all existing functionality

## Getting Started

### 1. Set Up the Database (Optional for Local Development)

For local development, you can use a local PostgreSQL database:

```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb slaops

# Run migrations
psql -d slaops -f apps/slaops-cloud/migrations/001_create_services_table.sql
```

For production, deploy the AWS infrastructure:

```bash
cd packages/slaops-backend
pnpm run deploy
```

### 2. Configure the Backend

```bash
cd apps/slaops-cloud

# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
# For local PostgreSQL:
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=slaops
DB_SSL=false
DB_LOGGING=true
```

### 3. Start the Backend

```bash
# Install dependencies (from root)
pnpm install

# Build the backend
pnpm --filter slaops-cloud run build

# Start in development mode
pnpm --filter slaops-cloud run start:dev
```

The API will be available at:
- API: http://localhost:3001
- Swagger docs: http://localhost:3001/api

### 4. Configure the Portal

```bash
cd apps/slaops-portal

# Create .env file
echo "VITE_API_BASE_URL=http://localhost:3001" > .env
```

### 5. Start the Portal

```bash
# From root or portal directory
pnpm --filter vite_react_shadcn_ts run dev
```

The portal will be available at: http://localhost:8080

## API Documentation

### Endpoints

All endpoints are prefixed with `/services`:

#### GET /services
Get all services with optional field selection.

**Query Parameters**:
- `select` (optional): Comma-separated list of fields

**Example**:
```bash
curl http://localhost:3001/services?select=id,name,endpoint
```

#### GET /services/:id
Get a single service by ID.

**Query Parameters**:
- `select` (optional): Comma-separated list of fields

#### POST /services
Create a new service.

**Body**:
```json
{
  "user_id": "uuid",
  "name": "Service Name",
  "endpoint": "https://api.example.com",
  "openapi_doc_url": "https://...",
  "availability": 99.99,
  "response_time": 100
}
```

#### PATCH /services/:id
Update an existing service.

#### DELETE /services/:id
Delete a service.

### Swagger Documentation

Interactive API documentation is available at:
http://localhost:3001/api

## Compatibility Notes

### Supabase vs SLAOps Cloud API

The new API maintains compatibility with the Supabase interface:

| Feature | Supabase | SLAOps Cloud API | Compatible? |
|---------|----------|------------------|-------------|
| `from()` | ✅ | ✅ | ✅ |
| `select()` | ✅ | ✅ | ✅ (comma-separated, no spaces) |
| `order()` | ✅ | ⚠️ | ⚠️ (client-side only, backend orders by created_at DESC) |
| `insert()` | ✅ | ✅ | ✅ |
| `update()` | ✅ | ✅ | ✅ (with `.eq('id', value)`) |
| `delete()` | ✅ | ✅ | ✅ (with `.eq('id', value)`) |
| `eq()` | ✅ | ⚠️ | ⚠️ (only supports `id` field) |
| `single()` | ✅ | ❌ | ❌ (use `findOne(id)` instead) |

### Breaking Changes

1. **Field selection syntax**: Remove spaces after commas
   ```typescript
   // Before
   .select("id, name, endpoint")

   // After
   .select("id,name,endpoint")
   ```

2. **Single record queries**: Use direct `findOne()` method
   ```typescript
   // Before
   const { data } = await supabase
     .from("services")
     .select("*")
     .eq("id", id)
     .single();

   // After
   const { data } = await servicesApi.findOne(id);
   ```

3. **Authentication**: Currently using hardcoded user_id
   ```typescript
   // Temporary - will be replaced with Cognito
   const user_id = "5c963787-d89d-4260-adaf-6541c41cb982";
   ```

## Deployment

### Backend Deployment Options

1. **AWS Amplify** (Recommended)
   - Add build spec for NestJS app
   - Deploy alongside existing Amplify infrastructure

2. **AWS Fargate/ECS**
   - Containerize the NestJS application
   - Deploy to ECS with auto-scaling

3. **AWS Lambda + API Gateway**
   - Use `@nestjs/platform-serverless`
   - Deploy as Lambda functions

### Database Deployment

The Aurora Serverless database is deployed via AWS CDK:

```bash
cd packages/slaops-backend
pnpm run deploy
```

This creates:
- Aurora Serverless v2 cluster (PostgreSQL 15.5)
- VPC with proper networking
- Security groups
- Secrets Manager entry
- Bastion host for access

### Environment Variables for Production

Backend (`.env`):
```env
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://portal.slaops.com

DB_HOST=<rds-endpoint>
DB_PORT=5432
DB_USERNAME=<from-secrets-manager>
DB_PASSWORD=<from-secrets-manager>
DB_NAME=slaops
DB_SSL=true
DB_LOGGING=false
```

Portal (`.env`):
```env
VITE_API_BASE_URL=https://api.slaops.com
```

## Testing

### Backend Tests

```bash
pnpm --filter slaops-cloud run test
```

### Integration Testing

1. Start the backend
2. Test endpoints with curl or Swagger UI
3. Start the portal and test UI interactions

### Example Test Scenario

1. Create a service via API:
   ```bash
   curl -X POST http://localhost:3001/services \
     -H "Content-Type: application/json" \
     -d '{
       "user_id": "test-user-id",
       "name": "Test API",
       "endpoint": "https://api.test.com"
     }'
   ```

2. Verify in portal dashboard
3. View service details
4. Update service
5. Delete service

## Rollback Plan

If issues arise, the portal can be rolled back to Supabase:

1. Revert portal file changes:
   ```bash
   git revert <migration-commit-hash>
   ```

2. Restore Supabase environment variables:
   ```bash
   VITE_SUPABASE_URL=<your-url>
   VITE_SUPABASE_PUBLISHABLE_KEY=<your-key>
   ```

3. Redeploy portal

## Future Work

### Immediate

1. ✅ Create NestJS backend
2. ✅ Set up Aurora Serverless PostgreSQL
3. ✅ Create API client library
4. ✅ Update portal to use new backend
5. ⬜ Integrate AWS Cognito authentication
6. ⬜ Deploy to production

### Future Enhancements

1. Add comprehensive test coverage
2. Implement request logging
3. Add rate limiting
4. Set up monitoring and alerting
5. Implement caching layer (Redis)
6. Add GraphQL support
7. Implement real-time features (WebSockets)
8. Add audit logging
9. Implement API versioning
10. Add request/response validation

## Support

For issues or questions:
- Backend: See `apps/slaops-cloud/README.md`
- Infrastructure: See `packages/slaops-backend/README.md`
- API Client: See `apps/slaops-portal/src/lib/api/`

## License

MIT
