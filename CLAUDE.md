# SLAOps Platform

A comprehensive monorepo for the SLAOps platform - a DevOps engineering solution for monitoring, logging, and analyzing HTTP requests and API usage across your applications.

## Overview

SLAOps (Service Level Agreement Operations) provides tools and libraries for:

- HTTP request/response monitoring and logging
- OpenAPI specification validation and analysis
- API performance tracking and metrics
- SLA compliance monitoring
- Cost analysis for API usage
- Real-time alerts and notifications

This monorepo contains both the core client libraries for instrumenting applications and the platform applications (documentation site and web portal).

## Monorepo Structure

```
slaops-platform/
├── packages/                    # Shared libraries and utilities
│   ├── slaops-private/            # @slaops/private - Core types and utilities (private)
│   ├── slaops-public/             # @slaops/public - Shared utilities
│   ├── slaops-config/          # @slaops/config - Type-safe configuration management
│   ├── slaops-client/          # @slaops/client - Base HTTP client
│   ├── slaops-client-nodejs-axios/  # Axios-specific client implementation
│   ├── slaops-infra/           # @slaops/infra - CDK infrastructure stacks (databases, VPC)
│   ├── slaops-backend/         # @slaops/backend - AWS Amplify infrastructure for the lambda function only
│   └── slaops-test/            # @slaops/test - Integration tests (dev dependencies on all packages)
│
├── apps/                        # Platform applications
│   ├── slaops-docs/            # Docusaurus documentation site
│   └── slaops-portal/          # React web portal for monitoring
│
├── scripts/                     # Utility scripts
│   ├── ai-commit.sh            # AI-powered git commit helper
│   ├── generate-commit-message.cjs  # Commit message generator
│   └── README.md               # Scripts documentation
│
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── package.json                # Root package configuration
├── tsconfig.base.json          # Shared TypeScript configuration
└── CLAUDE.md                   # This file
```

## Technology Stack

### Package Manager

- **pnpm 8.15.4+** - Fast, disk space efficient package manager for monorepos

### Core Technologies

- **TypeScript 5.6.3+** - Type-safe JavaScript
- **Node.js >= 22.0.0** - Runtime environment
- **tsup** - TypeScript bundler for packages
- **Vitest** - Unit testing framework

### Build System

- **Turborepo 2.6.1** - High-performance build system with caching
- **pnpm workspaces** - Monorepo workspace management
- **Dependency graph**: core → lib → client → client-nodejs-axios

See [TURBO.md](TURBO.md) for detailed Turborepo documentation.

### Backend Infrastructure

- **AWS Amplify Gen 2** - TypeScript-based Infrastructure as Code
- **AWS CDK 2.130.0** - Cloud Development Kit for AWS resources
- **AWS Cognito** - Authentication and user management

## Getting Started

### Prerequisites

1. **Node.js >= 22.0.0**

   ```bash
   # Install using nvm (recommended)
   nvm use
   # or install Node.js 22+ manually
   ```

2. **pnpm 8.15.4+**
   ```bash
   npm install -g pnpm@8.15.4
   # or
   corepack enable pnpm
   ```

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd slaops-platform

# Install all dependencies (from root)
pnpm install --frozen-lockfile

# Build all packages in dependency order
pnpm run build
```

## Development Workflow

### Building Packages

```bash
# Build all packages in dependency order
pnpm run build

# Build specific package
pnpm --filter @slaops/private run build
pnpm --filter @slaops/public run build
pnpm --filter @slaops/config run build
pnpm --filter @slaops/client run build
pnpm --filter slaops-client-nodejs-axios run build

# Build specific app
pnpm --filter @slaops/docs run build
pnpm --filter @slaops/portal run build
```

### Running in Development

```bash
# Run all packages in watch mode
pnpm run dev

# Run specific package
pnpm --filter @slaops/private run dev
pnpm --filter @slaops/config run dev
pnpm --filter @slaops/docs start
pnpm --filter @slaops/portal run dev
```

### Testing

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Test specific package
pnpm --filter @slaops/private run test
```

### Test Resources

The monorepo uses external test resources (primarily OpenAPI specifications from the [APIs-guru/openapi-directory](https://github.com/APIs-guru/openapi-directory)) for comprehensive testing. These resources are:

- **Automatically set up** during `pnpm install` via postinstall script
- **Not included in source control** (gitignored)
- **Excluded from IDE indexing** (via .cursorignore and .claudeignore)

```bash
# Manual setup/refresh of test resources
pnpm run setup:test-resources

# Verify test resources are available
ls test-resources/openapi-directory/APIs
```

**Using test resources in tests:**

```typescript
import {
  loadOpenApiSpec,
  listAvailableSpecs,
  findSpecs,
} from '@slaops/private/src/test-utils/openapi-loader'

// Load a specific OpenAPI spec
const spec = await loadOpenApiSpec('github.com', 'api.github.com', '1.1.4')

// Find all GitHub specs
const githubSpecs = await findSpecs('github')
```

See [test-resources/README.md](test-resources/README.md) for complete documentation on available test resources and utilities.

### Cleaning

```bash
# Remove all build artifacts and node_modules
pnpm run clean
```

## Package Details

### @slaops/private (packages/slaops-private/)

**Core types and utilities for SLA Ops**

- **Status**: Private (not published to npm)
- **Purpose**: Foundation types, interfaces, and utilities shared across all packages
- **Output**: ESM + CJS with TypeScript declarations
- **Dependencies**: None (base package)

Key exports:

- Core TypeScript types and interfaces
- Shared constants and enums
- Base utility functions

```bash
cd packages/slaops-private
pnpm run build      # Build with tsup
pnpm run test       # Run tests
pnpm run dev        # Watch mode
```

### @slaops/public (packages/slaops-public/)

**Shared utilities for SLA Ops**

- **Status**: Public (published to npm)
- **Purpose**: Reusable utility functions and helpers
- **Output**: ESM + CJS with TypeScript declarations
- **Dependencies**: @slaops/private

Key exports:

- HTTP request/response utilities
- Data transformation helpers
- Validation functions
- Common utilities

```bash
cd packages/slaops-public
pnpm run build      # Build with tsup
pnpm run test       # Run tests
pnpm run dev        # Watch mode
```

### @slaops/config (packages/slaops-config/)

**Type-safe configuration management for SLA Ops**

- **Status**: Private (not published to npm)
- **Purpose**: Centralized, Zod-validated environment variable handling
- **Output**: ESM + CJS with TypeScript declarations
- **Dependencies**: Zod 3.23.0

**IMPORTANT**: Always use the config module for accessing configuration values. Never reference `process.env` directly in application code.

```typescript
// ✅ Correct - use the config module
import { config } from '@slaops/config';

const port = config["app.port"];
const dbHost = config["db.host"];

// ❌ Wrong - do not access process.env directly
const port = process.env.PORT;
```

Key exports:

- `config` - Pre-built configuration singleton with dot-notation access
- `ConfigSchema` - Zod schema for validating environment variables
- `loadConfig(env)` - Pure function to load and validate config from env object
- `configFromEnv(env?)` - Cached config loader (caches for `process.env`, not for custom env)
- `makeConfig(cfg?)` - Transforms raw env config into structured `AppConfig` object
- `setConfigForProcess(config)` - Override cached config (useful for testing)
- `resetConfigForTests()` - Clear cached config for test isolation

**Configuration access** (dot-notation keys):

```typescript
config["app.port"]              // Application settings
config["db.host"]               // Database settings
config["opensearch.endpoint"]   // OpenSearch settings
config["opensearch.index"](entity)  // Function to generate index names
```

See `packages/slaops-config/src/schema.ts` for all available configuration keys.

**Testing with custom config**:

```typescript
import { loadConfig, resetConfigForTests } from '@slaops/config';

// In test setup - use custom env
const testConfig = loadConfig({
  NODE_ENV: 'test',
  DB_NAME: 'test_db',
  // ... other required vars
});

// In test teardown
afterEach(() => {
  resetConfigForTests();
});
```

```bash
cd packages/slaops-config
pnpm run build      # Build with tsup
pnpm run dev        # Watch mode
```

### @slaops/client (packages/slaops-client/)

**Base HTTP client for SLA Ops**

- **Status**: Public (published to npm)
- **Purpose**: Base client implementation that can be extended for specific HTTP clients
- **Output**: ESM + CJS with TypeScript declarations
- **Dependencies**: @slaops/private

Key exports:

- `SlaOpsClient` base class
- Client configuration types
- Event sending logic
- HTTP client abstractions

```bash
cd packages/slaops-client
pnpm run build      # Build with tsup
pnpm run test       # Run tests
pnpm run dev        # Watch mode
```

### slaops-client-nodejs-axios (packages/slaops-client-nodejs-axios/)

**Axios-specific client for Node.js/TypeScript**

- **Status**: Public (published to npm)
- **Purpose**: Production-ready Axios client with interceptor support
- **Output**: ESM + CJS with TypeScript declarations
- **Dependencies**: @slaops/private, @slaops/client

Key features:

- Automatic request/response capture via Axios interceptors
- Configurable header redaction
- Optional request/response body capture
- Internal request prevention (no recursive interception)
- Minimal overhead

Example usage:

```typescript
import axios from 'axios'
import { attachSlaOpsInterceptor } from 'slaops-client-nodejs-axios'

const api = axios.create({ baseURL: 'https://api.example.com' })

attachSlaOpsInterceptor(api, {
  endpoint: process.env.SLAOPS_ENDPOINT!,
  apiKey: process.env.SLAOPS_API_KEY,
  projectId: 'my-project',
  redactHeaders: [/authorization/i, /cookie/i],
  includeRequestBody: false,
  includeResponseBody: false,
})
```

```bash
cd packages/slaops-client-nodejs-axios
pnpm run build      # Build with tsup
pnpm run test       # Run tests
pnpm run dev        # Watch mode
```

### @slaops/test (packages/slaops-test/)

**Integration test package with dependencies on all SLAOps packages**

- **Status**: Private (not published to npm)
- **Purpose**: Convenient location for writing integration tests that require multiple packages
- **Output**: ESM + CJS with TypeScript declarations
- **Dependencies**: All other @slaops packages (as dev dependencies)

Key features:

- Has dev dependencies on all SLAOps packages (@slaops/private, @slaops/public, @slaops/client, @slaops/client-nodejs-axios)
- Provides a convenient testing environment for cross-package integration tests
- No need to manually wire up package dependencies for multi-package tests
- Includes example integration tests

Usage:

- Write integration tests in `src/__tests__/` or use `.test.ts` suffix
- Import from any SLAOps package without additional setup
- Run tests that verify how packages work together

```bash
cd packages/slaops-test
pnpm run build      # Build with tsup
pnpm run test       # Run tests
pnpm run dev        # Watch mode
```

### @slaops/infra (packages/slaops-infra/)

**AWS CDK Infrastructure Stacks for SLA Ops Platform**

- **Status**: Private (not published to npm)
- **Purpose**: Long-lived infrastructure resources (databases, VPC, networking) separate from feature deployments
- **Technology**: AWS CDK 2.130.0 with TypeScript
- **AWS Region**: ap-southeast-2 (Sydney) or configurable via environment
- **Dependencies**: aws-cdk-lib, constructs, source-map-support

Key features:

- **Separation of Concerns**: Infrastructure separated from Amplify feature deployments
- **Aurora Serverless v2**: PostgreSQL 15.5 with auto-scaling (0.5-2 ACU)
- **High Availability**: Multi-AZ VPC with public, private, and isolated subnets
- **Security**: Database in isolated subnets, credentials in Secrets Manager
- **Bastion Host**: Secure database access for development and debugging
- **CloudFormation Exports**: Stack outputs available to other stacks (including Amplify)

**Current Resources**:

**AuthStack** - Authentication infrastructure:
- **Cognito User Pool**: Email-based authentication with password policy
- **User Pool Client**: OAuth client for web applications
- **MFA Support**: Optional TOTP-based MFA
- **Advanced Security**: AWS threat detection enabled

**DatabaseStack** - Database infrastructure:
- **VPC**: Multi-AZ with NAT Gateway, 3-tier subnet architecture
- **Aurora Serverless v2**: PostgreSQL cluster with writer and reader instances
- **Secrets Manager**: Database credentials
- **Security Groups**: Network access control
- **Bastion Host**: EC2 instance for SSH tunneling to database

**ApiStack** - API Gateway infrastructure:
- **API Gateway REST API**: Regional endpoint with CORS
- **Lambda Proxy Integration**: Routes to Amplify-deployed Lambda
- **Rate Limiting**: 50 req/sec with 100 burst
- **CloudWatch Logging**: Request/response logging

**Exported CloudFormation Outputs**:

Auth Stack:
- `SlaOpsUserPoolId` - Cognito User Pool ID
- `SlaOpsUserPoolArn` - User Pool ARN
- `SlaOpsUserPoolClientId` - Client ID for web apps
- `SlaOpsUserPoolProviderName` - Provider name
- `SlaOpsUserPoolProviderUrl` - Provider URL

Database Stack:
- `SlaOpsDbClusterEndpoint` - Writer endpoint
- `SlaOpsDbClusterReadEndpoint` - Reader endpoint
- `SlaOpsDbName` - Database name (slaops)
- `SlaOpsDbSecretArn` - Credentials ARN
- `SlaOpsDbPort` - Port (5432)
- `SlaOpsBastionHostId` - Bastion instance ID
- `SlaOpsVpcId` - VPC ID

API Stack:
- `SlaOpsApiUrl` - API Gateway base URL
- `SlaOpsApiId` - API Gateway ID
- `SlaOpsApiArn` - API Gateway ARN
- `SlaOpsApiEndpoint` - API endpoint with stage (/prod)

**Commands**:

```bash
cd packages/slaops-infra

# Type-check infrastructure code
pnpm run build

# Type-check in watch mode
pnpm run dev

# Synthesize CloudFormation template
pnpm run synth

# View changes before deploying
pnpm run diff

# Deploy infrastructure
pnpm run deploy

# Bootstrap CDK (one-time setup)
pnpm run bootstrap

# Destroy infrastructure (creates snapshot)
pnpm run destroy

# Clean build artifacts
pnpm run clean
```

**Root-level convenience scripts**:

```bash
# From monorepo root
pnpm infra:build       # Type-check infrastructure
pnpm infra:synth       # Synthesize CloudFormation
pnpm infra:diff        # View changes
pnpm infra:deploy      # Deploy infrastructure
pnpm infra:deploy:all  # Deploy all stacks
pnpm infra:destroy     # Destroy infrastructure
pnpm infra:bootstrap   # Bootstrap CDK
pnpm infra:clean       # Clean artifacts
```

**Architecture**:

The infrastructure package uses standard CDK patterns:

```
packages/slaops-infra/
├── bin/
│   └── cdk.ts              # CDK app entry point
├── lib/
│   └── database-stack.ts   # Database infrastructure stack
├── cdk.json                # CDK configuration
├── package.json
├── tsconfig.json
└── README.md
```

**Integration with Amplify**:

The Amplify backend (packages/slaops-backend) can reference infrastructure outputs:

```typescript
import * as cdk from 'aws-cdk-lib'

// Import database endpoint from infra stack
const dbEndpoint = cdk.Fn.importValue('SlaOpsDbClusterEndpoint')
const secretArn = cdk.Fn.importValue('SlaOpsDbSecretArn')
```

This separation allows:

- Independent deployment cycles for infrastructure and features
- Database persists across feature deployments and rollbacks
- Stable infrastructure foundation for multiple Amplify stacks
- Reduced risk of accidental infrastructure changes during feature updates

See [packages/slaops-infra/README.md](packages/slaops-infra/README.md) for detailed documentation.

```bash
cd packages/slaops-infra
pnpm run build      # Type-check
pnpm run deploy     # Deploy infrastructure
```

### @slaops/backend (packages/slaops-backend/)

**AWS Amplify Infrastructure for SLA Ops Platform**

- **Status**: Private (not published to npm)
- **Purpose**: Feature-based infrastructure (authentication, APIs, functions) that deploys frequently
- **Technology**: AWS Amplify Gen 2 with TypeScript
- **AWS Region**: ap-southeast-2 (Sydney)
- **Dependencies**: @aws-amplify/backend, aws-cdk-lib, constructs

Key features:

- Type-safe infrastructure definitions in TypeScript
- AWS Cognito authentication with email-based login
- Local sandbox environment for testing
- GitOps-friendly deployment workflow
- CloudFormation-based resource provisioning
- References long-lived infrastructure from @slaops/infra

**Current Resources**:

- **Lambda Function**: NestJS API from `apps/slaops-cloud` deployed as serverless function
- **Infrastructure References**: Imports database and auth from `@slaops/infra` via CloudFormation
- **Exports**: Lambda function ARN for API Gateway integration

All infrastructure resources (authentication, database, VPC, API Gateway) are managed in @slaops/infra. This package only contains the Lambda function deployment.

**File Structure**:

```
slaops-backend/
├── amplify/
│   ├── functions/
│   │   └── api/
│   │       └── resource.ts  # Lambda function definition
│   └── backend.ts           # Main backend (imports infra exports)
├── .amplify/                # Build artifacts (gitignored)
├── amplify_outputs.json     # Generated configuration
├── package.json
└── tsconfig.json
```

**Commands**:

```bash
cd packages/slaops-backend

# Type-check backend configuration
pnpm run build

# Type-check in watch mode
pnpm run dev

# Run local sandbox environment (creates temporary AWS resources)
pnpm run sandbox

# Deploy to AWS
pnpm run deploy

# Pull backend configuration from cloud
pnpm run pull

# Clean build artifacts
pnpm run clean
```

**Root-level convenience scripts**:

```bash
# From monorepo root
pnpm amplify:sandbox    # Run backend in sandbox mode
pnpm amplify:deploy     # Deploy backend to AWS
pnpm amplify:clean      # Clean .amplify artifacts
```

**Adding Feature Resources**:

To add new feature-specific AWS resources (GraphQL APIs, storage, Lambda functions):

1. Create directory under `amplify/` (e.g., `amplify/data/`, `amplify/functions/`)
2. Define resource in `resource.ts` using Amplify's `define*` functions
3. Import and add to `amplify/backend.ts`
4. Reference infrastructure stack outputs if needed

Example:

```typescript
// amplify/data/resource.ts
import { defineData } from '@aws-amplify/backend'

export const data = defineData({
  // ... configuration
})

// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend'
import { data } from './data/resource'
import * as cdk from 'aws-cdk-lib'

const backend = defineBackend({
  data,
})

// Reference infrastructure resources if needed
const userPoolId = cdk.Fn.importValue('SlaOpsUserPoolId')
const dbEndpoint = cdk.Fn.importValue('SlaOpsDbClusterEndpoint')
```

**Integration with Frontend**:

Frontend apps integrate with the backend using `amplify_outputs.json`:

```typescript
import { Amplify } from 'aws-amplify'
import outputs from './amplify_outputs.json'

Amplify.configure(outputs)
```

See [packages/slaops-backend/README.md](packages/slaops-backend/README.md) for detailed documentation.

```bash
cd packages/slaops-backend
pnpm run build      # Type-check
pnpm run sandbox    # Local development
pnpm run deploy     # Production deployment
```

### @slaops/docs (apps/slaops-docs/)

**Docusaurus documentation site**

- **Status**: Private
- **Purpose**: Platform documentation at https://blog.SLAOps.com
- **Technology**: Docusaurus 3.9.2 with React 19
- **Port**: 3000 (development)

Key features:

- Comprehensive guides and tutorials
- API reference documentation
- Blog with release notes
- Changelog tracking
- Mermaid diagrams and math equations

See [apps/slaops-docs/CLAUDE.md](apps/slaops-docs/CLAUDE.md) for detailed documentation.

```bash
cd apps/slaops-docs
pnpm start          # Start dev server
pnpm run build      # Build for production
pnpm run serve      # Preview production build
```

### @slaops/portal (apps/slaops-portal/)

**React web portal for monitoring**

- **Status**: Private
- **Purpose**: Dashboard for viewing metrics, logs, and alerts
- **Technology**: React 18 + Vite + TypeScript + AWS Amplify + Supabase
- **Authentication**: AWS Cognito (via @slaops/backend)
- **Backend Integration**: AWS Amplify outputs from amplify_outputs.json
- **Port**: 8080 (development)

Key features:

- Real-time service monitoring
- API performance metrics
- Cost analysis and tracking
- Alert management
- Service configuration
- AWS Amplify authentication integration
- Cognito user management
- shadcn/ui component library

See [apps/slaops-portal/CLAUDE.md](apps/slaops-portal/CLAUDE.md) for detailed documentation.

```bash
cd apps/slaops-portal
pnpm run dev        # Start dev server
pnpm run build      # Build for production
pnpm run build:dev  # Build for development
```

## Build Order and Dependencies

The packages have a specific dependency hierarchy that must be respected when building:

```
@slaops/private (no dependencies)
    ↓
@slaops/public (depends on private)
@slaops/config (depends on zod - standalone)
    ↓
@slaops/client (depends on public)
    ↓
@slaops/client-nodejs-axios (depends on public, client)
    ↓
@slaops/test (dev dependencies on all packages - built last)
```

The root `pnpm run build` script handles this order automatically:

```bash
pnpm -r --filter @slaops/private run build &&
pnpm -r --filter @slaops/public run build &&
pnpm -r --filter @slaops/config run build &&
pnpm -r --filter @slaops/client run build &&
pnpm -r --filter @slaops/client-nodejs-axios run build &&
pnpm -r --filter @slaops/test run build &&
pnpm -r --filter @slaops/docs run build &&
pnpm -r --filter @slaops/portal run build
```

## Working with the Monorepo

### Adding Dependencies

```bash
# Add to root (dev dependencies only)
pnpm add -D -w <package>

# Add to specific workspace
pnpm --filter @slaops/private add <package>
pnpm --filter @slaops/docs add <package>

# Add workspace dependency
cd packages/slaops-public
# Edit package.json to add "@slaops/private": "*"
pnpm install
```

### Creating a New Package

1. Create directory in `packages/` or `apps/`
2. Initialize with `package.json`:
   ```json
   {
     "name": "@slaops/new-package",
     "version": "0.1.0",
     "type": "module",
     "main": "./dist/index.cjs",
     "module": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "scripts": {
       "build": "tsup src/index.ts --format esm,cjs --dts --clean"
     }
   }
   ```
3. Run `pnpm install` from root
4. Add to build script if needed

### pnpm Workspace Commands

```bash
# List all workspaces
pnpm -r list

# Run command in all workspaces
pnpm -r <command>

# Run command in specific workspace
pnpm --filter <workspace-name> <command>

# Run command in multiple workspaces
pnpm --filter @slaops/* run build

# Update dependencies
pnpm update -r
pnpm update --filter @slaops/private
```

## Git Workflow

### Branches

- `main` - Primary development branch

## CI/CD

### GitHub Actions

Located in `.github/workflows/`:

- Conditional builds based on changed paths
- Separate workflows for docs and portal
- Build verification on pull requests

### AWS Amplify

**Backend Infrastructure** (`packages/slaops-backend/`):

- Infrastructure as Code using AWS Amplify Gen 2
- TypeScript-based resource definitions
- Sandbox environments for local development
- Production deployments via `pnpm amplify:deploy`
- CloudFormation stack management via AWS CDK

**Frontend Apps** (`apps/slaops-docs/` and `apps/slaops-portal/`):

- `amplify.yml` - Build specification
- `amplify-prebuild.sh` - Environment setup
- `amplify-build.sh` - Build execution
- Conditional builds based on file changes
- Caching: NVM, pnpm store, Turbo cache

## Scripts Reference

### Root Level Scripts

```bash
pnpm run build        # Build all packages and apps
pnpm run dev          # Run all packages in development mode
pnpm run test         # Run all tests
pnpm run test:watch   # Run all tests in watch mode
pnpm run clean        # Remove all build artifacts and node_modules
pnpm run commit       # AI-powered git commit with generated message
pnpm run commit:ai    # Alias for commit

# AWS Infrastructure (CDK)
pnpm infra:build       # Type-check infrastructure
pnpm infra:synth       # Synthesize CloudFormation
pnpm infra:diff        # View changes before deploy
pnpm infra:deploy      # Deploy infrastructure
pnpm infra:deploy:all  # Deploy all stacks
pnpm infra:destroy     # Destroy infrastructure
pnpm infra:bootstrap   # Bootstrap CDK (one-time)
pnpm infra:clean       # Clean CDK artifacts

# AWS Amplify Backend
pnpm amplify:sandbox  # Run backend in sandbox mode
pnpm amplify:deploy   # Deploy backend to AWS
pnpm amplify:clean    # Clean Amplify artifacts
```

### Utility Scripts

#### AI Commit (`scripts/ai-commit.sh`)

An AI-powered git commit helper that generates meaningful commit messages based on your changes.

**Features:**

- Analyzes git diff and changed files
- Generates contextual commit messages
- Interactive editor for review and editing
- Confirms before committing

**Usage:**

```bash
# Using pnpm script (recommended)
pnpm commit

# Direct execution
./scripts/ai-commit.sh
```

**Workflow:**

1. Detects staged or unstaged changes
2. Prompts to stage files if needed
3. Generates an AI commit message
4. Opens editor for review
5. Confirms and commits

See [scripts/README.md](scripts/README.md) for detailed documentation.

### Package Level Scripts

Each package typically has:

```bash
pnpm run build        # Build with tsup
pnpm run dev          # TypeScript watch mode
pnpm run test         # Run vitest
pnpm run test:watch   # Run vitest in watch mode
```

### App Level Scripts

**@slaops/docs**:

```bash
pnpm start            # Development server
pnpm run build        # Production build
pnpm run serve        # Preview production build
pnpm run clear        # Clear cache
pnpm run typecheck    # Type checking
```

**@slaops/portal**:

```bash
pnpm run dev          # Development server
pnpm run build        # Production build
pnpm run build:dev    # Development build
pnpm run preview      # Preview production build
pnpm run lint         # ESLint
```

## Environment Configuration

### Root Level

- `.nvmrc` - Node.js version (22)
- `.prettierrc` - Code formatting rules
- `.editorconfig` - Editor configuration
- `tsconfig.base.json` - Base TypeScript config

### Package Level

Each package/app may have:

- `tsconfig.json` - Package-specific TypeScript config
- `.env` files - Environment variables (not committed)
- Build configuration files

## Common Tasks

### Adding a New Feature

1. Determine which package(s) need changes
2. Create feature branch
3. Make changes, ensuring tests pass
4. Build affected packages: `pnpm --filter <package> run build`
5. Test integration: `pnpm run test`
6. Update documentation if needed
7. Commit and push

### Publishing Packages

```bash
# Ensure all tests pass
pnpm run test

# Build all packages
pnpm run build

# Publish (from package directory)
cd packages/slaops-client-nodejs-axios
npm publish --access public
```

### Debugging Build Issues

1. Check build order - core must build before lib, etc.
2. Verify all dependencies are installed: `pnpm install`
3. Clear all builds: `pnpm run clean`
4. Rebuild from scratch: `pnpm install && pnpm run build`
5. Check for TypeScript errors: `pnpm -r run typecheck` (where available)

### Updating Dependencies

```bash
# Check for outdated dependencies
pnpm outdated -r

# Update all dependencies
pnpm update -r

# Update specific package
pnpm --filter @slaops/private update <dependency>
```

## Troubleshooting

### "Module not found" errors

- Ensure packages are built in correct order
- Run `pnpm run build` from root
- Check `package.json` dependencies are correct

### pnpm install fails

- Verify pnpm version: `pnpm --version`
- Try: `pnpm install --no-frozen-lockfile`
- Check Node.js version matches `.nvmrc`

### TypeScript errors across packages

- Rebuild core packages first
- Ensure `tsconfig.base.json` is properly referenced
- Check package exports in `package.json`

### Port conflicts (apps)

- @slaops/docs uses port 3000
- @slaops/portal uses port 8080
- Change ports in respective configs if needed

## Best Practices

### Code Organization

- Keep shared code in `@slaops/private` and `@slaops/public`
- Specific implementations go in their own packages
- Apps should depend on packages, not vice versa

### Environment Variables & Configuration

**IMPORTANT**: Never access `process.env` directly in application code. Always use the `@slaops/config` module:

```typescript
// ✅ Correct
import { config } from '@slaops/config';
const port = config["app.port"];

// ❌ Wrong - do not do this
const port = process.env.PORT;
```

Benefits of using `@slaops/config`:
- Type-safe configuration with Zod validation
- Runtime validation on application startup
- Centralized configuration management
- Consistent access patterns across the codebase
- Easy testing with `resetConfigForTests()` and custom env objects

### TypeScript

- Use strict mode
- Define types in core packages
- Export only necessary types
- Use consistent module resolution

### TypeScript Path Mappings

**Why paths can't be centralized in `tsconfig.base.json`:**

TypeScript's `paths` are resolved relative to `baseUrl`. When a child config defines its own `baseUrl` (which most do), it overrides the parent's. Additionally, when a child defines `paths`, it completely **replaces** the parent's paths rather than merging them.

**Convention for cross-module path mappings:**

When you need to enable IDE navigation to source files in another module (e.g., importing from `apps/slaops-cloud`), you must add the path mapping to **each** tsconfig.json that needs it:

```typescript
// In packages/*/tsconfig.json (two levels deep from root):
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@slaops/package-name/*": ["./src/*"],
      "@slaops/cloud/*": ["../../apps/slaops-cloud/src/*"]
    }
  }
}

// In apps/*/tsconfig.json (sibling directories):
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@slaops/app-name/*": ["./src/*"],
      "@slaops/cloud/*": ["../slaops-cloud/src/*"]
    }
  }
}
```

**Current cross-module mappings:**

- `@slaops/cloud/*` → Maps to `apps/slaops-cloud/src/*` for IDE navigation to the NestJS backend source

**Adding a new cross-module path mapping:**

1. Determine the relative path from each module to the target source
2. Add the path mapping to each tsconfig.json that needs it
3. Use `../../` for packages (two levels up to root, then down to apps/)
4. Use `../` for apps (one level up, then to sibling app/)

### Testing

- Write unit tests for all packages
- Keep tests close to source code
- Use Vitest for consistency
- Aim for high coverage on core packages

### Documentation

- **IMPORTANT**: When completing tasks, add or update documentation in [apps/slaops-docs/](apps/slaops-docs/)
- Before starting a task, review existing documentation in [apps/slaops-docs/docs/](apps/slaops-docs/docs/) for context
- Update CLAUDE.md files when making significant changes
- Keep README.md files up to date
- Document public APIs thoroughly in the docs site
- Include usage examples and code snippets
- Update relevant documentation in the same commit as code changes

### Git

- Commit messages should be clear and descriptive
- Keep commits focused and atomic
- Update relevant documentation in the same commit
- Test builds before pushing

## Architecture Decisions

### Why pnpm?

- Efficient disk space usage via hard links
- Strict dependency resolution prevents phantom dependencies
- Fast installation and better monorepo support
- Native workspace support

### Why TypeScript?

- Type safety across the entire codebase
- Better IDE support and autocomplete
- Easier refactoring
- Self-documenting code

### Why tsup?

- Fast TypeScript bundler
- Zero-config for most use cases
- Supports ESM + CJS output
- Good DX with watch mode

### Monorepo Strategy

- Shared code in packages for reusability
- Apps consume packages as dependencies
- Build order enforced by dependency graph
- Independent versioning possible

## Resources

### Documentation

- Main docs: https://blog.SLAOps.com
- Package READMEs in each package directory
- Individual CLAUDE.md files in apps/

### External Links

- [pnpm documentation](https://pnpm.io/)
- [TypeScript handbook](https://www.typescriptlang.org/docs/)
- [Vitest documentation](https://vitest.dev/)
- [tsup documentation](https://tsup.egoist.dev/)

### Repository

- Issues: Create issues in the GitHub repository
- Pull Requests: Follow the standard PR process
- Discussions: Use GitHub Discussions for questions

### Commit Messages

For commit messages look at @scripts/ai-commit.sh for the prompt and the format.

## License

MIT License (see LICENSE file)

## Author

SLAOps@SLAOps.com

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and build: `pnpm run test && pnpm run build`
5. Submit a pull request

---

**Last Updated**: January 2026

This file provides guidance for working with the SLAOps monorepo. For app-specific details, see:

- [apps/slaops-docs/CLAUDE.md](apps/slaops-docs/CLAUDE.md) - Documentation site
- [apps/slaops-portal/CLAUDE.md](apps/slaops-portal/CLAUDE.md) - Web portal

For package-specific details, see the README.md in each package directory.



## Conventions can be found at [CONVENTIONS.md](CONVENTIONS.md)