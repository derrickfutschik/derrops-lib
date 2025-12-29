# @slaops/backend

AWS Amplify Infrastructure for SLA Ops Platform

## Overview

This package contains the AWS Amplify backend infrastructure definitions for the SLAOps platform. It uses AWS Amplify Gen 2 with TypeScript to define cloud resources including authentication, APIs, storage, and more.

## Structure

```
slaops-backend/
├── amplify/
│   ├── auth/
│   │   └── resource.ts      # Cognito authentication configuration
│   └── backend.ts           # Main backend definition
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

### Authentication

Email-based authentication with the following configuration:

- **Login method**: Email
- **Required attributes**: Email (immutable)
- **Account recovery**: Email only
- **Provider**: AWS Cognito

Configuration: `amplify/auth/resource.ts`

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

## Adding Resources

To add new resources:

1. Create a new directory under `amplify/` (e.g., `amplify/data/`)
2. Define the resource in `resource.ts`
3. Import and add to `amplify/backend.ts`

Example:

```typescript
// amplify/data/resource.ts
import { defineData } from '@aws-amplify/backend';

export const data = defineData({
  // ... configuration
});

// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

const backend = defineBackend({
  auth,
  data,
});
```

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
