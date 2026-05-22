#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import 'source-map-support/register'
import { ApiStack } from '../lib/stack/apigateway'
import { AppDatabaseStack } from '../lib/stack/app-database'
import { OpenApiBucketStack } from '../lib/stack/app-openapi-bucket'
import { OpenSearchStack } from '../lib/stack/app-opensearch'
import { HostedZoneStack } from '../lib/stack/private-hosted-zone'
import { SecurityGroupStack } from '../lib/stack/security-group'
import { TenantStack } from '../lib/stack/tenant'
import { UserPoolStack } from '../lib/stack/userpool'
import { VpcStack } from '../lib/stack/vpc'
import { resources } from '../lib/names'
import { config } from '@derrops/config'

const app = new cdk.App()


const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',
}

const appEnv = process.env.ENVIRONMENT || 'prod'

// Apply common tags to every resource in the entire app.
// derrops:domain and derrops:service are stack-specific — set inside each constructor.

cdk.Tags.of(app).add('derrops:managed-by', 'cdk')


const userpoolStack = new UserPoolStack(config.convention.with({ domain: 'user-management', service: "userpool" }), app, 'DerropsUserPoolStack', {
  description: 'Derrops User Pool Stack',
  env,
})

const globalTenantStack = new TenantStack(config.convention.with({ domain: 'tenant', service: 'infra', tenant: config['oaspec.storage.global-tenant-id'] }), app, `DerropsTenantStack-${config['oaspec.storage.global-tenant-id']}`, {
  description: 'Derrops Global Tenant Infrastructure Stack',
  env,
})

app.synth()


/**
// VPC infrastructure stack (deployed first, exports used by other stacks)
// Contains VPC, subnets, NAT gateways, and VPC endpoints
const vpcStack = new VpcStack(app, 'DerropsVpcStack', {
  stackName: 'derrops--platform--vpc',
  description: 'Derrops VPC Infrastructure - Networking resources',
  env,
})


// Database infrastructure stack
// Contains Aurora Serverless v2 PostgreSQL cluster (imports VPC from VPC stack)
const databaseStack = new AppDatabaseStack(app, 'DerropsDatabaseStack', {
  stackName: 'derrops--platform--app-database',
  description: 'Derrops Database Infrastructure - Aurora Serverless v2 PostgreSQL',
  env,
})

// Database stack depends on VPC stack (for VPC exports)
databaseStack.addDependency(vpcStack)

// Security Group infrastructure stack
// Contains centralized security groups for OpenSearch, RDS, and Lambda backend
const securityGroupStack = new SecurityGroupStack(app, 'DerropsSecurityGroupStack', {
  stackName: 'derrops--platform--security-groups',
  description: 'Derrops Security Group Infrastructure - Centralized security groups',
  env,
})

// Security group stack depends on VPC stack (for VPC exports)
securityGroupStack.addDependency(vpcStack)

// Private Hosted Zone infrastructure stack
// Contains Route53 private hosted zone associated with the VPC
const hostedZoneStack = new HostedZoneStack(app, 'DerropsHostedZoneStack', {
  stackName: 'derrops--platform--dns',
  description: 'Derrops Private Hosted Zone Infrastructure - Route53 private hosted zone',
  env,
})

// Hosted zone stack depends on VPC stack (for VPC exports)
hostedZoneStack.addDependency(vpcStack)

// OpenSearch infrastructure stack
// Contains OpenSearch Serverless collection (imports VPC and security group)
const opensearchStack = new OpenSearchStack(app, 'DerropsOpenSearchStack', {
  stackName: 'derrops--platform--opensearch',
  description: 'Derrops OpenSearch Infrastructure - OpenSearch Serverless collection',
  env,
  singleNodeMode: appEnv === 'development' || appEnv === 'dev',
})

// OpenSearch stack depends on VPC stack and Security Group stack
opensearchStack.addDependency(vpcStack)
opensearchStack.addDependency(securityGroupStack)

// OpenAPI Bucket infrastructure stack
// Contains S3 bucket for Derrops-managed OpenAPI specifications (APIs-guru format)
new OpenApiBucketStack(app, 'DerropsOpenApiBucketStack', {
  stackName: 'derrops--oaspec--source',
  description: 'Derrops OpenAPI Source Bucket - S3 bucket for Derrops-managed OpenAPI specifications',
  env,
})

// API Gateway infrastructure stack
// Contains REST API that proxies to the Lambda function deployed by Amplify
// NOTE: Deploy Amplify backend first to create the Lambda function,
//       then deploy this stack with the Lambda ARN
const lambdaFunctionArn =
  process.env.LAMBDA_FUNCTION_ARN || app.node.tryGetContext('lambdaFunctionArn')

if (lambdaFunctionArn) {
  new ApiStack(app, 'DerropsApiStack', {
    stackName: 'derrops--platform--api-gateway',
    description: 'Derrops API Infrastructure - API Gateway REST API',
    env,
  })
} else {
  console.warn(
    '\n⚠️  WARNING: Lambda function ARN not provided. Skipping API stack deployment.\n' +
    '   To deploy the API stack:\n' +
    '   1. Deploy Amplify backend first: pnpm amplify:deploy\n' +
    '   2. Get Lambda ARN from Amplify outputs\n' +
    '   3. Deploy with: LAMBDA_FUNCTION_ARN=<arn> pnpm infra:deploy\n' +
    '   Or use: pnpm run cdk deploy --context lambdaFunctionArn=<arn>\n',
  )
}

app.synth()


 */