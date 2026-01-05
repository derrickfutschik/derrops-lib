# @slaops/infra

AWS CDK Infrastructure Stacks for SLA Ops Platform

## Overview

This package contains the infrastructure-as-code definitions for long-lived AWS resources that persist across feature deployments. These resources are managed separately from the Amplify backend to ensure stability and prevent accidental destruction during feature updates.

## What's Included

### Auth Stack

The `AuthStack` includes:

- **Cognito User Pool**: Email-based authentication
- **User Pool Client**: Web application OAuth client
- **Password Policy**: Enforced complexity requirements
- **MFA Support**: Optional TOTP-based MFA
- **Account Recovery**: Email-based password recovery
- **Advanced Security**: AWS threat detection enabled

### Database Stack

The `DatabaseStack` includes:

- **VPC**: Multi-AZ VPC with public, private, and isolated subnets
- **Aurora Serverless v2**: PostgreSQL 15.5 cluster with writer and reader instances
- **Secrets Manager**: Secure database credentials storage
- **Bastion Host**: EC2 instance for secure database access
- **Security Groups**: Network access control

### API Stack

The `ApiStack` includes:

- **API Gateway REST API**: Regional endpoint with CORS support
- **Lambda Integration**: Proxy integration to NestJS Lambda function
- **Rate Limiting**: 50 req/sec with 100 burst limit
- **CloudWatch Logging**: Request/response logging and metrics
- **Stage**: Production stage with deployment options

### Key Features

**Authentication:**
- **Email Login**: Sign in with email and password
- **Self Sign-Up**: Users can register themselves
- **Password Policy**: Min 8 chars with complexity requirements
- **MFA**: Optional time-based one-time passwords
- **Security**: Advanced threat detection and prevention
- **Token Validity**: 1-hour access/ID tokens, 30-day refresh tokens

**Database:**
- **Serverless Scaling**: 0.5-2 ACU with automatic scaling
- **High Availability**: Multi-AZ deployment with reader instance
- **Backup & Recovery**: 7-day backup retention with automated backups
- **Encryption**: Storage encryption enabled
- **Network Isolation**: Database in isolated subnets, no public access

**API:**
- **REST API**: Regional API Gateway endpoint
- **CORS**: Configurable origin support
- **Throttling**: Rate limiting and burst protection
- **Logging**: CloudWatch integration for monitoring
- **Lambda Proxy**: Full request/response proxying to NestJS

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **CDK CLI** installed globally: `npm install -g aws-cdk`
3. **Node.js >= 22.0.0**
4. **pnpm 8.15.4+**

## Installation

```bash
# From monorepo root
pnpm install

# Or from this package
cd packages/slaops-infra
pnpm install
```

## Usage

### Bootstrap CDK (One-time setup)

Before deploying for the first time, bootstrap your AWS environment:

```bash
# From this package directory
pnpm run bootstrap

# Or using CDK directly
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

### Deploy Infrastructure

```bash
# From monorepo root
pnpm infra:deploy

# Or from this package
pnpm run deploy

# Deploy all stacks
pnpm run deploy:all
```

### View Changes Before Deploying

```bash
pnpm run diff
```

### Synthesize CloudFormation Template

```bash
pnpm run synth
```

### Destroy Infrastructure

**⚠️ WARNING**: This will delete the database. A snapshot will be taken before deletion.

```bash
pnpm run destroy
```

## Exported Outputs

The stacks export the following CloudFormation outputs that can be referenced by other stacks:

### Auth Stack Exports

| Export Name | Description |
|------------|-------------|
| `SlaOpsUserPoolId` | Cognito User Pool ID |
| `SlaOpsUserPoolArn` | Cognito User Pool ARN |
| `SlaOpsUserPoolClientId` | User Pool Client ID for web apps |
| `SlaOpsUserPoolProviderName` | User Pool provider name |
| `SlaOpsUserPoolProviderUrl` | User Pool provider URL |

### Database Stack Exports

| Export Name | Description |
|------------|-------------|
| `SlaOpsDbClusterEndpoint` | Aurora cluster writer endpoint |
| `SlaOpsDbClusterReadEndpoint` | Aurora cluster reader endpoint |
| `SlaOpsDbName` | Database name (slaops) |
| `SlaOpsDbSecretArn` | ARN of database credentials secret |
| `SlaOpsDbPort` | Database port (5432) |
| `SlaOpsBastionHostId` | Bastion host instance ID |
| `SlaOpsVpcId` | VPC ID |

### API Stack Exports

| Export Name | Description |
|------------|-------------|
| `SlaOpsApiUrl` | API Gateway base URL |
| `SlaOpsApiId` | API Gateway REST API ID |
| `SlaOpsApiArn` | API Gateway ARN |
| `SlaOpsApiEndpoint` | API endpoint with stage (prod) |

### Referencing Outputs in Other Stacks

```typescript
import * as cdk from 'aws-cdk-lib';

// Import auth resources
const userPoolId = cdk.Fn.importValue('SlaOpsUserPoolId');
const userPoolClientId = cdk.Fn.importValue('SlaOpsUserPoolClientId');

// Import database resources
const dbEndpoint = cdk.Fn.importValue('SlaOpsDbClusterEndpoint');
const secretArn = cdk.Fn.importValue('SlaOpsDbSecretArn');
```

## Accessing the Database

### Via Bastion Host

1. Get the bastion host ID:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name slaops-database-infrastructure \
     --query 'Stacks[0].Outputs[?ExportName==`SlaOpsBastionHostId`].OutputValue' \
     --output text
   ```

2. Connect via Systems Manager Session Manager:
   ```bash
   aws ssm start-session --target <bastion-instance-id>
   ```

3. Set up SSH tunnel:
   ```bash
   aws ssm start-session \
     --target <bastion-instance-id> \
     --document-name AWS-StartPortForwardingSessionToRemoteHost \
     --parameters '{"host":["<database-endpoint>"],"portNumber":["5432"],"localPortNumber":["5432"]}'
   ```

4. Connect to database:
   ```bash
   # Get credentials from Secrets Manager
   aws secretsmanager get-secret-value \
     --secret-id slaops/database/credentials \
     --query SecretString --output text | jq -r '.password'

   # Connect with psql
   psql -h localhost -p 5432 -U slaops_admin -d slaops
   ```

## Configuration

### Environment Variables

- `CDK_DEFAULT_ACCOUNT`: AWS account ID (auto-detected if not set)
- `CDK_DEFAULT_REGION`: AWS region (defaults to ap-southeast-2)
- `ENVIRONMENT`: Environment name (defaults to production)

### Customization

Edit `lib/database-stack.ts` to customize:

- VPC configuration (CIDR blocks, subnet layout)
- Aurora capacity (min/max ACU)
- Backup retention period
- PostgreSQL version
- Instance types

## Stack Architecture

```
┌─────────────────────────────────────┐
│     Auth Stack                      │
│  ┌───────────────────────────────┐  │
│  │  Cognito User Pool            │  │
│  │  └─ User Pool Client          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

┌─────────────────────────────────────────┐
│     Database Stack                      │
│  ┌─────────────────────────────────┐   │
│  │         VPC (Multi-AZ)          │   │
│  │  ┌──────────────────────────┐   │   │
│  │  │   Public Subnets         │   │   │
│  │  │   └─ Bastion Host (EC2)  │   │   │
│  │  └──────────────────────────┘   │   │
│  │  ┌──────────────────────────┐   │   │
│  │  │   Private Subnets        │   │   │
│  │  │   └─ (Lambda, ECS)       │   │   │
│  │  └──────────────────────────┘   │   │
│  │  ┌──────────────────────────┐   │   │
│  │  │   Isolated Subnets       │   │   │
│  │  │   └─ Aurora Serverless   │   │   │
│  │  │      ├─ Writer           │   │   │
│  │  │      └─ Reader           │   │   │
│  │  └──────────────────────────┘   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────┐               │
│  │  Secrets Manager    │               │
│  │  └─ DB Credentials  │               │
│  └─────────────────────┘               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────┐
│     API Stack                       │
│  ┌───────────────────────────────┐  │
│  │  API Gateway REST API         │  │
│  │  └─ /prod/* → Lambda (Amplify)  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Cost Considerations

**Auth Stack:**
- **Cognito**: Free tier covers 50,000 MAU, then $0.0055/MAU
- **Advanced Security**: $0.05/MAU

**Database Stack:**
- **Aurora Serverless v2**: ~$0.12/ACU-hour (scales 0.5-2 ACU)
- **NAT Gateway**: ~$0.045/hour + data transfer
- **Bastion Host**: ~$0.0116/hour (t3.micro)
- **Backups**: First 100GB free, then $0.021/GB-month

**Estimated monthly cost**: $60-180 depending on usage and MAU

### Cost Optimization

- Bastion host can be stopped when not in use
- Consider removing NAT Gateway for production (use VPC endpoints)
- Adjust Aurora capacity based on workload

## Troubleshooting

### Stack Creation Fails

```bash
# View stack events
aws cloudformation describe-stack-events \
  --stack-name slaops-database-infrastructure

# Check CDK diff
pnpm run diff
```

### Can't Connect to Database

1. Verify bastion host is running
2. Check security group rules
3. Verify database cluster is available
4. Confirm credentials in Secrets Manager

### Update Stack

```bash
# View changes
pnpm run diff

# Deploy changes
pnpm run deploy
```

## Best Practices

1. **Never commit credentials**: All secrets are in Secrets Manager
2. **Use snapshots**: Database has `SNAPSHOT` removal policy
3. **Review diffs**: Always run `diff` before deploying
4. **Tag resources**: All resources tagged with Project/Environment
5. **Backup verification**: Test restore procedures regularly

## Deployment Order

Due to stack dependencies, deploy in this order:

### 1. Deploy Auth and Database Stacks

```bash
# Deploy infrastructure (Auth + Database only, API stack skipped)
pnpm infra:deploy

# This deploys:
# - AuthStack (Cognito User Pool)
# - DatabaseStack (Aurora + VPC)
# API stack is skipped because Lambda ARN is not yet available
```

### 2. Deploy Amplify Backend (Lambda Function)

```bash
# Deploy Amplify backend with Lambda function
pnpm amplify:deploy

# This creates the Lambda function and exports its ARN
```

### 3. Deploy API Stack

```bash
# Get the Lambda ARN from Amplify outputs
LAMBDA_ARN=$(aws cloudformation describe-stacks \
  --stack-name <amplify-stack-name> \
  --query 'Stacks[0].Outputs[?ExportName==`SlaOpsLambdaFunctionArn`].OutputValue' \
  --output text)

# Deploy API Gateway stack
LAMBDA_FUNCTION_ARN=$LAMBDA_ARN pnpm infra:deploy

# Or use context parameter
pnpm --filter @slaops/infra run cdk deploy SlaOpsApiStack \
  --context lambdaFunctionArn=$LAMBDA_ARN
```

### Stack Dependencies

```
1. Infrastructure (Auth + Database)
   └─ Exports: UserPoolId, DB endpoint, Secret ARN

2. Amplify Backend (Lambda)
   ├─ Imports: UserPoolId, DB endpoint, Secret ARN
   └─ Exports: Lambda ARN

3. Infrastructure (API Gateway)
   └─ Imports: Lambda ARN
```

## Integration with Amplify Backend

The Amplify backend (in `packages/slaops-backend`) references these infrastructure resources via CloudFormation exports. The API Gateway (in this package) references the Lambda function deployed by Amplify. This separation allows:

- **Independent deployment cycles**: Infrastructure changes don't require Amplify redeployment
- **Stability**: Database and API Gateway persist across Lambda updates
- **Rollback safety**: Lambda rollbacks don't affect infrastructure
- **Clear separation**: Infrastructure (stable) vs application code (frequently updated)

## Development Workflow

1. Make changes to stack definitions in `lib/`
2. Run `pnpm run diff` to review changes
3. Run `pnpm run synth` to generate CloudFormation
4. Run `pnpm run deploy` to deploy changes
5. Verify outputs with `aws cloudformation describe-stacks`

## Scripts

| Script | Description |
|--------|-------------|
| `build` | Type-check TypeScript |
| `dev` | Type-check in watch mode |
| `typecheck` | Run TypeScript type checking |
| `cdk` | Run CDK CLI commands |
| `synth` | Synthesize CloudFormation template |
| `diff` | Compare deployed stack with local changes |
| `deploy` | Deploy stack to AWS |
| `deploy:all` | Deploy all stacks |
| `destroy` | Destroy stack (with snapshot) |
| `bootstrap` | Bootstrap CDK in AWS account |
| `clean` | Remove build artifacts |

## Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)
- [VPC Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-best-practices.html)

## License

MIT

## Support

For issues or questions, contact: SLAOps@SLAOps.com
