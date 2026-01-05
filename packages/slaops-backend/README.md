# @slaops/backend

AWS Amplify Backend for SLA Ops Platform

## Overview

This package contains the AWS Amplify Gen 2 backend configuration for the SLAOps platform. It integrates the NestJS API from `apps/slaops-cloud` and deploys it as a serverless Lambda function with API Gateway, connecting to infrastructure resources (Auth, Database) from `@slaops/infra`.

## Architecture

- **NestJS API as Lambda**: The `slaops-cloud` NestJS app runs in AWS Lambda
- **Infrastructure Integration**: References Cognito and Aurora from `@slaops/infra` via CloudFormation exports
- **No Database Definition**: Database is managed entirely in `@slaops/infra` package
- **No API Gateway**: API Gateway is managed in `@slaops/infra` package, Lambda ARN is exported for reference

## Structure

```
slaops-backend/
├── amplify/
│   ├── functions/
│   │   └── api/
│   │       └── resource.ts  # Lambda function definition
│   └── backend.ts           # Main backend configuration
├── .amplify/                # Build artifacts (gitignored)
├── amplify_outputs.json     # Generated configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Prerequisites

- Node.js >= 22.0.0
- pnpm 8.15.4+
- AWS CLI configured with appropriate credentials

### Installation

From the monorepo root:

```bash
pnpm install
```

### Commands

```bash
# Type-check the backend configuration
pnpm run build

# Type-check in watch mode
pnpm run dev

# Run local sandbox environment
pnpm run sandbox

# Deploy to AWS
pnpm run deploy

# Pull backend configuration from cloud
pnpm run pull

# Clean build artifacts
pnpm run clean
```

## Backend Resources

### Lambda Function (NestJS API)

The NestJS application from `apps/slaops-cloud` is deployed as a Lambda function:

- **Entry point**: `apps/slaops-cloud/src/lambda.ts`
- **Runtime**: Node.js 20
- **Memory**: 512MB
- **Timeout**: 30 seconds
- **Integration**: API Gateway proxy integration

Configuration: `amplify/functions/api/resource.ts`

### Infrastructure References

The backend imports resources from `@slaops/infra`:

- **Database**: Aurora Serverless v2 endpoint and credentials
- **Authentication**: Cognito User Pool
- **Secrets**: Database credentials from Secrets Manager

**Prerequisites**: Deploy infrastructure first:
```bash
# Deploy Auth and Database stacks
pnpm infra:deploy

# Then deploy this Amplify backend (Lambda)
pnpm amplify:deploy

# Finally deploy API Gateway (in infra package)
LAMBDA_FUNCTION_ARN=$(aws cloudformation describe-stacks \
  --stack-name <amplify-stack-name> \
  --query 'Stacks[0].Outputs[?ExportName==`SlaOpsLambdaFunctionArn`].OutputValue' \
  --output text) pnpm infra:deploy
```

## Local Development

To run the backend locally:

```bash
pnpm run sandbox
```

This will:
- Deploy a sandbox environment to AWS
- Watch for changes and hot-reload
- Provide local endpoints for testing

## Deployment

### Sandbox (Development)

```bash
pnpm run sandbox
```

Creates a temporary cloud environment for development and testing.

### Production

```bash
pnpm run deploy
```

Deploys to your AWS account with production settings.

## Configuration

The backend is configured using TypeScript files in the `amplify/` directory:

- `amplify/backend.ts` - Main backend definition that imports all resources
- `amplify/auth/resource.ts` - Authentication configuration
- Add more resources as needed (data, storage, functions, etc.)

## AWS Amplify Gen 2

This project uses AWS Amplify Gen 2, which provides:

- **Type-safe configuration** - Define infrastructure in TypeScript
- **Local development** - Test changes in a sandbox environment
- **GitOps workflow** - Infrastructure as code in your repository
- **Automatic deployments** - Connected to your git branches

### Key Concepts

1. **defineBackend()** - Main entry point that combines all resources
2. **defineAuth()** - Configure authentication and authorization
3. **defineData()** - Define GraphQL APIs and databases (add as needed)
4. **defineStorage()** - Configure S3 storage (add as needed)
5. **defineFunction()** - Create Lambda functions (add as needed)

## Exported Outputs

The Amplify backend exports:

- `SlaOpsLambdaFunctionArn` - Lambda function ARN (for API Gateway integration)
- `SlaOpsLambdaFunctionName` - Lambda function name

## API Endpoints

The API Gateway is managed in `@slaops/infra` package. Once deployed, the API is available at:

```bash
# Get API URL from infrastructure stack
aws cloudformation describe-stacks \
  --stack-name slaops-api-infrastructure \
  --query 'Stacks[0].Outputs[?ExportName==`SlaOpsApiEndpoint`].OutputValue' \
  --output text
```

### NestJS REST API

All requests to the API Gateway are proxied to this Lambda function:

```
GET    /prod/services           # List all services
POST   /prod/services           # Create service
GET    /prod/services/:id       # Get service by ID
PATCH  /prod/services/:id       # Update service
DELETE /prod/services/:id       # Delete service
GET    /prod/api                # Swagger documentation
```


## Environment Variables

The Lambda function has access to:

- `DB_HOST` - Database endpoint (from infrastructure stack)
- `DB_SECRET_ARN` - Secrets Manager ARN for database credentials
- `USER_POOL_ID` - Cognito User Pool ID
- `NODE_ENV` - Set to 'production'
- `DB_PORT` - PostgreSQL port (5432)
- `DB_NAME` - Database name (slaops)
- `DB_SSL` - Enable SSL (true)

Database credentials are automatically retrieved from Secrets Manager at runtime.

## Adding Resources

To add new resources:

1. Create a new directory under `amplify/` (e.g., `amplify/storage/`)
2. Define the resource in `resource.ts`
3. Import and add to `amplify/backend.ts`

Example:

```typescript
// amplify/storage/resource.ts
import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  // ... configuration
});

// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { api } from './functions/api/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  api,
  storage,
});
```

**Important**: Do NOT define database resources here. All database resources (Aurora, VPC, networking) are managed in the `@slaops/infra` package and referenced via CloudFormation exports.

## Environment Variables

Amplify Gen 2 automatically manages environment variables. Access them in your app using:

```typescript
import { Amplify } from 'aws-amplify';
import outputs from './amplify_outputs.json';

Amplify.configure(outputs);
```

## CI/CD

This package is configured to work with AWS Amplify Hosting:

- Automatic builds on git push
- Branch-based environments
- Preview environments for PRs

## Troubleshooting

### Type Errors

Run type checking:
```bash
pnpm run typecheck
```

### Clean Build

If you encounter issues:
```bash
pnpm run clean
pnpm install
```

### Sandbox Issues

Reset the sandbox:
```bash
amplify sandbox delete
pnpm run sandbox
```

## Resources

- [AWS Amplify Gen 2 Documentation](https://docs.amplify.aws/)
- [Amplify Auth Documentation](https://docs.amplify.aws/gen2/build-a-backend/auth/)
- [AWS Amplify CLI](https://docs.amplify.aws/cli/)

## License

MIT License

## Author

SLAOps@SLAOps.com
