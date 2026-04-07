# @slaops/infra

AWS CDK infrastructure stacks for the SLAOps platform. Contains long-lived resources (VPC, database, auth, API Gateway) that are deployed independently from feature code. Other stacks (including Amplify) reference outputs from these stacks via `cdk.Fn.importValue(...)`.

**Region**: ap-southeast-2 (Sydney), or set via environment.

## Stacks

| Stack | Key resources |
|---|---|
| `AuthStack` | Cognito User Pool, User Pool Client, TOTP MFA, advanced security |
| `DatabaseStack` | VPC (multi-AZ, 3-tier subnets), Aurora Serverless v2 PostgreSQL 15.5, Secrets Manager, Bastion Host |
| `ApiStack` | API Gateway (REST, regional), Lambda proxy integration, rate limiting (50 rps / 100 burst), CloudWatch logging |

For each stack there is a corresponding `.md` file in `lib/stack/` with a description and Mermaid infrastructure diagram. See [`lib/stack/CLAUDE.md`](lib/stack/CLAUDE.md) for authoring rules.

## CloudFormation exports

**AuthStack**

| Export | Value |
|---|---|
| `SlaOpsUserPoolId` | Cognito User Pool ID |
| `SlaOpsUserPoolArn` | User Pool ARN |
| `SlaOpsUserPoolClientId` | Client ID for web apps |
| `SlaOpsUserPoolProviderName` | Provider name |
| `SlaOpsUserPoolProviderUrl` | Provider URL |

**DatabaseStack**

| Export | Value |
|---|---|
| `SlaOpsDbClusterEndpoint` | Writer endpoint |
| `SlaOpsDbClusterReadEndpoint` | Reader endpoint |
| `SlaOpsDbName` | Database name (`slaops`) |
| `SlaOpsDbSecretArn` | Credentials ARN (Secrets Manager) |
| `SlaOpsDbPort` | Port (`5432`) |
| `SlaOpsBastionHostId` | Bastion EC2 instance ID |
| `SlaOpsVpcId` | VPC ID |

**ApiStack**

| Export | Value |
|---|---|
| `SlaOpsApiUrl` | API Gateway base URL |
| `SlaOpsApiId` | API Gateway ID |
| `SlaOpsApiArn` | API Gateway ARN |
| `SlaOpsApiEndpoint` | API endpoint with stage (`/prod`) |

## Consuming outputs from another stack

```typescript
import * as cdk from 'aws-cdk-lib'

const dbEndpoint = cdk.Fn.importValue('SlaOpsDbClusterEndpoint')
const secretArn  = cdk.Fn.importValue('SlaOpsDbSecretArn')
```

## Commands

```bash
pnpm run build      # Type-check
pnpm run dev        # Watch mode
pnpm run synth      # Synthesize CloudFormation templates
pnpm run diff       # Preview changes before deploying
pnpm run deploy     # Deploy all stacks
pnpm run destroy    # Destroy stacks (creates snapshot first)
pnpm run bootstrap  # One-time CDK bootstrap
pnpm run clean      # Remove build artefacts
```

Root-level shortcuts: `pnpm infra:build`, `pnpm infra:synth`, `pnpm infra:diff`, `pnpm infra:deploy`, `pnpm infra:deploy:all`, `pnpm infra:destroy`, `pnpm infra:bootstrap`, `pnpm infra:clean`.
