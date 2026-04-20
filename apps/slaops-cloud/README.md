# @slaops/cloud

NestJS backend API for the SLAOps platform. Runs as a standalone server in development and as an AWS Lambda function in production.

## Features

- RESTful API for service management and OpenAPI indexing
- OpenSearch integration for spec search and analytics
- TypeORM with PostgreSQL (Aurora Serverless in production)
- Cloud Relay network: relay instance registry, Aegis instance registry, job queue, vendor JWT issuance
- Swagger/OpenAPI documentation at `/api`
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

Generates the OpenAPI spec to `dist/openapi.json` and `src/openapi.json`.

```bash
pnpm --filter @slaops/cloud run generate:client
```

Generates a typed Axios client to `apps/slaops-portal/src/client/slaops-cloud`.

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

## Module Structure

```
src/
├── app.module.ts                     # Root module — TypeORM, all feature modules
├── main.ts                           # Standalone server entry point
├── lambda.ts                         # AWS Lambda handler
├── openapi.ts                        # OpenAPI spec generator (runs post-build)
│
├── service/                          # Service registry CRUD
├── openapi-indexer/                  # OpenAPI spec indexing into OpenSearch
├── openapi-search/                   # OpenAPI search API
├── opensearch/                       # OpenSearch client, templates, pipelines
├── config/                           # Config module
│
├── vendor-jwt/                       # Platform vendor JWT issuance and JWKS
│   ├── vendor-jwt.module.ts
│   └── vendor-jwt.service.ts         # ES256 signing key, mint relay JWTs, JWKS export
│
├── relay-instance/                   # Relay instance registry
│   ├── relay-instance.module.ts
│   ├── relay-instance.service.ts     # CRUD + health check (calls relay /health)
│   ├── relay-instance.controller.ts  # GET/POST/PATCH/DELETE /cloud-relay/relay-instance
│   └── entities/
│       └── relay-instance.entity.ts  # relay_instance table
│
├── aegis-instance/                   # Aegis broker instance registry
│   ├── aegis-instance.module.ts
│   ├── aegis-instance.service.ts     # CRUD + registration token + health check
│   ├── aegis-instance.controller.ts  # GET/POST/PATCH/DELETE /cloud-relay/aegis-instance
│   ├── aegis-register.controller.ts  # POST /cloud-relay/aegis/register (called by Aegis)
│   └── entities/
│       └── aegis-instance.entity.ts  # aegis_instance table
│
└── cloud-relay/                      # Cloud relay connection + job queue
    ├── cloud-relay.module.ts
    ├── cloud-relay.service.ts        # Connection and job management
    ├── cloud-relay.controller.ts     # GET .well-known/jwks.json + connection/job endpoints
    └── entities/
        ├── cloud-relay-connection.entity.ts
        └── cloud-relay-job.entity.ts
```

## Cloud Relay Network

See the [Cloud Relay Component Design](../slaops-docs/notes/proposals/cloud-relay/component-cloud-relay.md) for the full architecture, sequence diagrams, and design decisions.

The cloud relay subsystem (`relay-instance/`, `aegis-instance/`, `cloud-relay/`, `vendor-jwt/`) implements the SLAOps relay network control plane:

| Module           | Responsibility                                                                       |
| ---------------- | ------------------------------------------------------------------------------------ |
| `vendor-jwt`     | Mint ES256 vendor JWTs (5-min TTL, relay-scoped) for platform→relay auth; serve JWKS |
| `relay-instance` | Registry of customer-deployed relay agents; health checks via vendor JWT             |
| `aegis-instance` | Registry of customer Aegis brokers; one-time registration token flow                 |
| `cloud-relay`    | Connection and job queue for proxying requests through a relay                       |

### Key Endpoints

| Method | Path                                           | Description                                     |
| ------ | ---------------------------------------------- | ----------------------------------------------- |
| `GET`  | `/.well-known/jwks.json`                       | Vendor signing public key in JWKS format        |
| `GET`  | `/cloud-relay/relay-instance`                  | List relay instances (tenant-scoped)            |
| `POST` | `/cloud-relay/relay-instance`                  | Register a new relay instance                   |
| `POST` | `/cloud-relay/relay-instance/:id/health-check` | Trigger health check for relay                  |
| `GET`  | `/cloud-relay/aegis-instance`                  | List Aegis broker instances                     |
| `POST` | `/cloud-relay/aegis-instance`                  | Register a new Aegis instance (generates token) |
| `POST` | `/cloud-relay/aegis/register`                  | Aegis self-registration handshake               |

## Deployment

### AWS Infrastructure

Database infrastructure (Aurora Serverless PostgreSQL) and API Gateway are defined in `packages/slaops-infra/`. Lambda deployment is managed via `packages/slaops-backend/` (AWS Amplify Gen 2).

See [packages/slaops-infra/README.md](../../packages/slaops-infra/README.md) and [packages/slaops-backend/README.md](../../packages/slaops-backend/README.md) for infrastructure setup.

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

# Cloud Relay — vendor JWT signing
# If unset, an ephemeral ES256 key is generated at startup (dev only)
SLAOPS_VENDOR_SIGNING_KEY_JWK={"kty":"EC","crv":"P-256",...}
```

## API Documentation

Once the server is running, visit `http://localhost:3001/api` for the interactive Swagger documentation.
