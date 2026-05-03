# @derrops/backend

AWS Amplify Gen 2 deployment package. Defines Lambda functions via `defineFunction` and wires them into the Amplify backend. Contains **no business logic** — only infrastructure definitions that point at `apps/derrops-cloud/`.

Long-lived resources (VPC, Aurora, Cognito, API Gateway) live in `@derrops/infra`. This package only deploys the Lambda function and references those outputs via `cdk.Fn.importValue(...)`.

**Region**: ap-southeast-2 (Sydney)

## Structure

```
amplify/
├── functions/
│   └── api/
│       └── resource.ts   # defineFunction — points at apps/derrops-cloud/src/lambda.ts
└── backend.ts            # defineBackend — imports infra CloudFormation exports
```

## Adding a new Lambda function

1. Create `amplify/functions/<name>/resource.ts` with `defineFunction`
2. Import and register in `amplify/backend.ts`
3. Reference infra outputs if needed via `cdk.Fn.importValue('Derrops...')`

```typescript
// amplify/functions/my-fn/resource.ts
import { defineFunction } from '@aws-amplify/backend'

export const myFn = defineFunction({
  name: 'derrops-my-fn',
  entry: '../../../../apps/derrops-cloud/src/my-handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
  runtime: 20,
  environment: {
    NODE_ENV: 'production',
  },
})
```

## Frontend integration

`amplify_outputs.json` (auto-generated) is consumed by the portal:

```typescript
import { Amplify } from 'aws-amplify'
import outputs from './amplify_outputs.json'
Amplify.configure(outputs)
```

## Commands

```bash
pnpm run build    # Type-check
pnpm run dev      # Watch mode
pnpm run sandbox  # Local sandbox (creates temporary AWS resources)
pnpm run deploy   # Deploy to AWS
pnpm run pull     # Pull backend configuration from cloud
pnpm run clean    # Remove .amplify artefacts
```

Root-level shortcuts: `pnpm amplify:sandbox`, `pnpm amplify:deploy`, `pnpm amplify:clean`.
