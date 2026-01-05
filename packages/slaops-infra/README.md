# @slaops/infra

AWS CDK Infrastructure Stacks for SLA Ops Platform

## Overview

This package contains the infrastructure-as-code definitions for long-lived AWS resources that persist across feature deployments. These resources are managed separately from the Amplify backend to ensure stability and prevent accidental destruction during feature updates.

The infrastructure is organized into separate, focused stacks that can be deployed and managed independently.

## What's Included

### VPC Stack

The `VpcStack` includes:

- **VPC**: Multi-AZ VPC with 3 availability zones
- **Subnets**: Public, private (with NAT egress), and isolated subnets (one per AZ)
- **NAT Gateways**: Configurable 1-3 NAT gateways for internet access
- **VPC Endpoints**: Optional S3, DynamoDB, Secrets Manager, CloudWatch Logs, EC2, ECR endpoints
- **Flow Logs**: Optional VPC flow logs for network monitoring

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

- **Aurora Serverless v2**: PostgreSQL 15.5 cluster with writer and reader instances
- **Secrets Manager**: Secure database credentials storage
- **Bastion Host**: EC2 instance for secure database access
- **Security Groups**: Database network access control

Note: The Database Stack imports VPC resources from the VPC Stack.

### Security Group Stack

The `SecurityGroupStack` includes:

- **OpenSearch Security Group**: For OpenSearch domain access
- **RDS Security Group**: For PostgreSQL database access
- **Backend Security Group**: For Lambda backend function
- **Inter-service Rules**: Pre-configured access between services

### Hosted Zone Stack

The `HostedZoneStack` includes:

- **Private Hosted Zone**: Route53 private DNS for VPC resources
- **Environment-based Naming**: `${env}.internal.slaops.com`

### API Stack

The `ApiStack` includes:

- **API Gateway REST API**: Regional endpoint with CORS support
- **Lambda Integration**: Proxy integration to NestJS Lambda function
- **Rate Limiting**: 50 req/sec with 100 burst limit
- **CloudWatch Logging**: Request/response logging and metrics
- **Stage**: Production stage with deployment options

### Key Features

**VPC & Networking:**
- **Multi-AZ**: 3 availability zones for high availability
- **Subnet Tiers**: Public, private, and isolated subnet layers
- **NAT Gateways**: Configurable 1-3 NAT gateways
- **VPC Endpoints**: Optional endpoints to reduce NAT costs
- **Flow Logs**: Optional network traffic monitoring

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

**Security:**
- **Centralized Security Groups**: Reusable security groups for all services
- **Least Privilege**: Only required traffic permitted between services
- **Service Isolation**: Separate security boundaries for each service

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

### VPC Stack Exports

| Export Name | Description |
|------------|-------------|
| `slaops-vpc-id` | VPC ID |
| `slaops-vpc-cidr-block` | VPC CIDR block |
| `slaops-vpc-subnet-public-a` | Public subnet A ID |
| `slaops-vpc-subnet-public-b` | Public subnet B ID |
| `slaops-vpc-subnet-public-c` | Public subnet C ID |
| `slaops-vpc-subnet-private-a` | Private subnet A ID |
| `slaops-vpc-subnet-private-b` | Private subnet B ID |
| `slaops-vpc-subnet-private-c` | Private subnet C ID |
| `slaops-vpc-subnet-isolated-a` | Isolated subnet A ID |
| `slaops-vpc-subnet-isolated-b` | Isolated subnet B ID |
| `slaops-vpc-subnet-isolated-c` | Isolated subnet C ID |

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

### Security Group Stack Exports

| Export Name | Description |
|------------|-------------|
| `slaops-opensearch-sg` | OpenSearch security group ID |
| `slaops-rds-sg` | RDS security group ID |
| `slaops-backend-sg` | Lambda backend security group ID |

### Hosted Zone Stack Exports

| Export Name | Description |
|------------|-------------|
| `slaops-hosted-zone-id` | Private hosted zone ID |
| `slaops-hosted-zone-name` | Private hosted zone name |

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
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// Import VPC resources
const vpcId = cdk.Fn.importValue('slaops-vpc-id');
const vpcCidrBlock = cdk.Fn.importValue('slaops-vpc-cidr-block');

// Create minimal VPC reference (only VPC ID needed for security groups)
const vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
  vpcId,
  availabilityZones: cdk.Fn.getAzs(), // Automatically uses first 3 AZs
});

// Import specific subnets if needed
const publicSubnetIds = [
  cdk.Fn.importValue('slaops-vpc-subnet-public-a'),
  cdk.Fn.importValue('slaops-vpc-subnet-public-b'),
  cdk.Fn.importValue('slaops-vpc-subnet-public-c'),
];

// Import auth resources
const userPoolId = cdk.Fn.importValue('SlaOpsUserPoolId');
const userPoolClientId = cdk.Fn.importValue('SlaOpsUserPoolClientId');

// Import database resources
const dbEndpoint = cdk.Fn.importValue('SlaOpsDbClusterEndpoint');
const secretArn = cdk.Fn.importValue('SlaOpsDbSecretArn');

// Import security groups
const backendSgId = cdk.Fn.importValue('slaops-backend-sg');
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

**VPC Stack** (`lib/stack/vpc.ts`):
- Number of NAT Gateways (1-3)
- VPC CIDR block
- Subnet CIDR masks
- Enable/disable VPC endpoints
- Enable/disable flow logs

**Database Stack** (`lib/stack/database.ts`):
- Aurora capacity (min/max ACU)
- Backup retention period
- PostgreSQL version
- Bastion instance type

**Auth Stack** (`lib/stack/userpool.ts`):
- Password policy
- MFA requirements
- Token validity periods
- OAuth flows

**Security Group Stack** (`lib/stack/security-group.ts`):
- Security group rules
- Port configurations
- CIDR ranges

**Hosted Zone Stack** (`lib/stack/hosted-zone.ts`):
- Zone name (defaults to `${env}.internal.slaops.com`)

**API Stack** (`lib/stack/apigateway.ts`):
- Rate limits
- CORS origins
- Logging levels
- Stage names

## Stack Architecture

```
┌────────────────────────────────────────────┐
│     VPC Stack                              │
│  ┌──────────────────────────────────────┐ │
│  │       VPC (Multi-AZ - 3 AZs)         │ │
│  │  ┌────────────────────────────────┐  │ │
│  │  │   Public Subnets (3)           │  │ │
│  │  │   └─ NAT Gateways              │  │ │
│  │  └────────────────────────────────┘  │ │
│  │  ┌────────────────────────────────┐  │ │
│  │  │   Private Subnets (3)          │  │ │
│  │  │   └─ With NAT egress           │  │ │
│  │  └────────────────────────────────┘  │ │
│  │  ┌────────────────────────────────┐  │ │
│  │  │   Isolated Subnets (3)         │  │ │
│  │  │   └─ No internet access        │  │ │
│  │  └────────────────────────────────┘  │ │
│  └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘
                    ↓ (imports VPC)
┌────────────────────────────────────────────┐
│     Security Group Stack                   │
│  ┌──────────────────────────────────────┐ │
│  │  OpenSearch Security Group           │ │
│  │  RDS Security Group                  │ │
│  │  Backend Lambda Security Group       │ │
│  │  └─ Pre-configured inter-service     │ │
│  │     access rules                     │ │
│  └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘
                    ↓ (imports VPC)
┌────────────────────────────────────────────┐
│     Hosted Zone Stack                      │
│  ┌──────────────────────────────────────┐ │
│  │  Route53 Private Hosted Zone         │ │
│  │  └─ ${env}.internal.slaops.com       │ │
│  └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘

┌─────────────────────────────────────┐
│     Auth Stack                      │
│  ┌───────────────────────────────┐  │
│  │  Cognito User Pool            │  │
│  │  └─ User Pool Client          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
                    ↓ (imports VPC)
┌────────────────────────────────────────────┐
│     Database Stack                         │
│  ┌──────────────────────────────────────┐ │
│  │  Aurora Serverless v2 PostgreSQL     │ │
│  │  ├─ Writer Instance (isolated)       │ │
│  │  └─ Reader Instance (isolated)       │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │  Bastion Host (public subnet)        │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │  Secrets Manager                     │ │
│  │  └─ DB Credentials                   │ │
│  └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘
                    ↓ (Lambda deployed separately)
┌─────────────────────────────────────┐
│     API Stack                       │
│  ┌───────────────────────────────┐  │
│  │  API Gateway REST API         │  │
│  │  └─ /prod/* → Lambda (Amplify)│  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Cost Considerations

**VPC Stack:**
- **NAT Gateway**: ~$0.045/hour (~$33/month per gateway) + data transfer ($0.045/GB)
- **VPC Endpoints**: Interface endpoints ~$0.01/hour (~$7.20/month each)
- **VPC Flow Logs**: CloudWatch Logs ingestion costs (if enabled)

**Auth Stack:**
- **Cognito**: Free tier covers 50,000 MAU, then $0.0055/MAU
- **Advanced Security**: $0.05/MAU

**Database Stack:**
- **Aurora Serverless v2**: ~$0.12/ACU-hour (scales 0.5-2 ACU)
- **Bastion Host**: ~$0.0116/hour (t3.micro)
- **Backups**: First 100GB free, then $0.021/GB-month

**Security Group Stack:**
- **No cost**: Security groups are free

**Hosted Zone Stack:**
- **Private Hosted Zone**: $0.50/month

**API Stack:**
- **API Gateway**: $3.50 per million requests + data transfer

**Estimated monthly cost**: $100-250 depending on:
- Number of NAT Gateways (1-3)
- VPC endpoints enabled
- Database utilization
- API traffic
- Active users (MAU)

### Cost Optimization

- **Use 1 NAT Gateway** for dev/staging (instead of 3)
- **Enable VPC Endpoints** for S3, DynamoDB (free) to reduce NAT costs
- **Stop Bastion Host** when not in use (~$8/month savings)
- **Disable VPC Flow Logs** in non-production environments
- **Adjust Aurora capacity** (min/max ACU) based on workload
- **Use security groups** instead of NACLs (no additional cost)

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

### 1. Deploy VPC Stack (First - Required by All)

```bash
# Deploy VPC infrastructure first
pnpm --filter @slaops/infra run cdk deploy SlaOpsVpcStack

# This deploys:
# - VPC with 3 AZs
# - Public, private, and isolated subnets
# - NAT gateways
# - VPC endpoints (if configured)
```

### 2. Deploy Security Group and Hosted Zone Stacks

```bash
# Deploy security groups and hosted zone (both depend on VPC)
pnpm --filter @slaops/infra run cdk deploy SlaOpsSecurityGroupStack
pnpm --filter @slaops/infra run cdk deploy SlaOpsHostedZoneStack
```

### 3. Deploy Auth and Database Stacks

```bash
# Deploy auth and database infrastructure
pnpm --filter @slaops/infra run cdk deploy SlaOpsAuthStack
pnpm --filter @slaops/infra run cdk deploy SlaOpsDatabaseStack

# Or deploy all at once (skips API stack if Lambda ARN not set)
pnpm infra:deploy:all
```

### 4. Deploy Amplify Backend (Lambda Function)

```bash
# Deploy Amplify backend with Lambda function
pnpm amplify:deploy

# This creates the Lambda function that references:
# - UserPoolId (from AuthStack)
# - DB endpoint (from DatabaseStack)
# - Security groups (from SecurityGroupStack)
```

### 5. Deploy API Stack (Last)

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
1. VPC Stack (no dependencies)
   └─ Exports: VPC ID, subnet IDs, CIDR block

2. Security Group Stack (depends on VPC)
   ├─ Imports: VPC ID
   └─ Exports: Security group IDs

3. Hosted Zone Stack (depends on VPC)
   ├─ Imports: VPC ID
   └─ Exports: Hosted zone ID

4. Auth Stack (no dependencies)
   └─ Exports: User Pool ID, Client ID

5. Database Stack (depends on VPC)
   ├─ Imports: VPC ID, CIDR, subnet IDs
   └─ Exports: DB endpoint, Secret ARN

6. Amplify Backend (Lambda)
   ├─ Imports: User Pool ID, DB endpoint, Security groups
   └─ Exports: Lambda ARN

7. API Gateway Stack (depends on Lambda)
   └─ Imports: Lambda ARN
```

## Integration with Amplify Backend

The infrastructure stacks export resources via CloudFormation that are imported by:
1. **Amplify Backend** (`packages/slaops-backend`) - imports VPC, Auth, Database, Security Groups
2. **API Gateway Stack** - imports Lambda ARN from Amplify

This separation provides:

- **Independent deployment cycles**: Infrastructure changes don't require Amplify redeployment
- **Stability**: VPC, Database, and API Gateway persist across Lambda updates
- **Rollback safety**: Lambda rollbacks don't affect infrastructure
- **Clear separation**: Infrastructure (stable) vs application code (frequently updated)
- **Modular architecture**: Each stack has a single responsibility
- **Flexible scaling**: Add new stacks without modifying existing ones

### Optimization: Minimal VPC Imports

The stacks are optimized to import only what they need:
- **Security groups**: Only VPC ID
- **Hosted zones**: Only VPC ID
- **Database**: VPC ID + specific subnet IDs (no full VPC reconstruction)

This reduces CloudFormation complexity and improves deployment speed.

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
