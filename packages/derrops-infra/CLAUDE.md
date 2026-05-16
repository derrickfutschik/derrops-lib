# @derrops/infra

AWS CDK infrastructure stacks for the Derrops platform. Contains long-lived resources (VPC, database, auth, API Gateway) that are deployed independently from feature code. Other stacks (including Amplify) reference outputs from these stacks via `cdk.Fn.importValue(...)`.

**Region**: ap-southeast-2 (Sydney), or set via environment.

## Stacks

| CDK Stack ID                | Key resources                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `DerropsUserPoolStack`      | Cognito User Pool, User Pool Client, TOTP MFA, advanced security                         |
| `DerropsVpcStack`           | VPC (multi-AZ, 3-tier subnets), NAT gateways, VPC endpoints                              |
| `DerropsDatabaseStack`      | Aurora Serverless v2 PostgreSQL 15.5, Secrets Manager, Bastion Host                      |
| `DerropsSecurityGroupStack` | Centralised security groups for OpenSearch, RDS, Lambda                                   |
| `DerropsHostedZoneStack`    | Route53 private hosted zone                                                               |
| `DerropsOpenSearchStack`    | OpenSearch Serverless collection                                                          |
| `DerropsOpenApiBucketStack` | S3 bucket for Derrops-managed OpenAPI specifications                                      |
| `DerropsApiStack`           | API Gateway (REST, regional), Lambda proxy integration, rate limiting, CloudWatch logging |

For each stack there is a corresponding `.md` file in `lib/stack/` with a description and Mermaid infrastructure diagram. See [`lib/stack/CLAUDE.md`](lib/stack/CLAUDE.md) for authoring rules.

## Working with individual stacks

Target a specific stack by passing its **CDK Stack ID** (the string passed to the `Stack` constructor, not the `stackName` prop) as a positional argument. Use the `cdk` passthrough script so CDK flags reach the CLI directly.

```bash
# Preview changes for one stack
pnpm --filter @derrops/infra run cdk diff DerropsUserPoolStack

# Deploy one stack (prompts for approval)
pnpm --filter @derrops/infra run cdk deploy DerropsUserPoolStack

# Deploy without approval prompt (CI / known-safe changes)
pnpm --filter @derrops/infra run cdk deploy DerropsUserPoolStack --require-approval never

# List all stacks and their synthesis status
pnpm --filter @derrops/infra run cdk ls

# Synthesise a single stack to inspect the CloudFormation template
pnpm --filter @derrops/infra run cdk synth DerropsUserPoolStack
```

### Stack dependencies

Some stacks consume CloudFormation exports from others. Deploy in this order when standing up from scratch:

```
DerropsVpcStack
  ├── DerropsDatabaseStack
  ├── DerropsSecurityGroupStack
  │     └── DerropsOpenSearchStack
  └── DerropsHostedZoneStack

DerropsOpenApiBucketStack   (independent)
DerropsUserPoolStack         (independent)
DerropsApiStack              (requires Amplify Lambda ARN — deploy last)
```

`cdk deploy --all` respects `addDependency()` calls and handles ordering automatically.

## CloudFormation exports

**AuthStack**

| Export                       | Value                  |
| ---------------------------- | ---------------------- |
| `DerropsUserPoolId`           | Cognito User Pool ID   |
| `DerropsUserPoolArn`          | User Pool ARN          |
| `DerropsUserPoolClientId`     | Client ID for web apps |
| `DerropsUserPoolProviderName` | Provider name          |
| `DerropsUserPoolProviderUrl`  | Provider URL           |

**DatabaseStack**

| Export                        | Value                             |
| ----------------------------- | --------------------------------- |
| `DerropsDbClusterEndpoint`     | Writer endpoint                   |
| `DerropsDbClusterReadEndpoint` | Reader endpoint                   |
| `DerropsDbName`                | Database name (`derrops`)          |
| `DerropsDbSecretArn`           | Credentials ARN (Secrets Manager) |
| `DerropsDbPort`                | Port (`5432`)                     |
| `DerropsBastionHostId`         | Bastion EC2 instance ID           |
| `DerropsVpcId`                 | VPC ID                            |

**ApiStack**

| Export              | Value                             |
| ------------------- | --------------------------------- |
| `DerropsApiUrl`      | API Gateway base URL              |
| `DerropsApiId`       | API Gateway ID                    |
| `DerropsApiArn`      | API Gateway ARN                   |
| `DerropsApiEndpoint` | API endpoint with stage (`/prod`) |

## Consuming outputs from another stack

```typescript
import * as cdk from 'aws-cdk-lib'

const dbEndpoint = cdk.Fn.importValue('DerropsDbClusterEndpoint')
const secretArn = cdk.Fn.importValue('DerropsDbSecretArn')
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
