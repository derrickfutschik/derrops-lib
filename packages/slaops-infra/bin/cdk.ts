#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import 'source-map-support/register'
import { ApiStack } from '../lib/stack/apigateway'
import { AppDatabaseStack } from '../lib/stack/app-database'
import { OpenApiBucketStack } from '../lib/stack/app-openapi-bucket'
import { OpenSearchStack } from '../lib/stack/app-opensearch'
import { HostedZoneStack } from '../lib/stack/private-hosted-zone'
import { SecurityGroupStack } from '../lib/stack/security-group'
import { AuthStack } from '../lib/stack/userpool'
import { VpcStack } from '../lib/stack/vpc'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',
}

// common tags for the environment
const tags = {
  Project: 'SLAOps',
  Environment: process.env.ENVIRONMENT || 'production',
  ManagedBy: 'CDK',
  Stack: 'Infrastructure',
}

// VPC infrastructure stack (deployed first, exports used by other stacks)
// Contains VPC, subnets, NAT gateways, and VPC endpoints
const vpcStack = new VpcStack(app, 'SlaOpsVpcStack', {
  stackName: 'slaops-vpc-infrastructure',
  description: 'SLAOps VPC Infrastructure - Networking resources',
  env,
  tags,
})

// Authentication infrastructure stack
// Contains Cognito User Pool and related auth resources
new AuthStack(app, 'SlaOpsAuthStack', {
  stackName: 'slaops-auth-infrastructure',
  description: 'SLAOps Authentication Infrastructure - Cognito User Pool',
  env,
  tags,
})

// Database infrastructure stack
// Contains Aurora Serverless v2 PostgreSQL cluster (imports VPC from VPC stack)
const databaseStack = new AppDatabaseStack(app, 'SlaOpsDatabaseStack', {
  stackName: 'slaops-database-infrastructure',
  description: 'SLAOps Database Infrastructure - Aurora Serverless v2 PostgreSQL',
  env,
  tags,
})

// Database stack depends on VPC stack (for VPC exports)
databaseStack.addDependency(vpcStack)

// Security Group infrastructure stack
// Contains centralized security groups for OpenSearch, RDS, and Lambda backend
const securityGroupStack = new SecurityGroupStack(app, 'SlaOpsSecurityGroupStack', {
  stackName: 'slaops-security-group-infrastructure',
  description: 'SLAOps Security Group Infrastructure - Centralized security groups',
  env,
  tags,
})

// Security group stack depends on VPC stack (for VPC exports)
securityGroupStack.addDependency(vpcStack)

// Private Hosted Zone infrastructure stack
// Contains Route53 private hosted zone associated with the VPC
const hostedZoneStack = new HostedZoneStack(app, 'SlaOpsHostedZoneStack', {
  stackName: 'slaops-hosted-zone-infrastructure',
  description: 'SLAOps Private Hosted Zone Infrastructure - Route53 private hosted zone',
  env,
  tags,
})

// Hosted zone stack depends on VPC stack (for VPC exports)
hostedZoneStack.addDependency(vpcStack)

// OpenSearch infrastructure stack
// Contains OpenSearch domain with configurable node count (imports VPC and security group)
const opensearchStack = new OpenSearchStack(app, 'SlaOpsOpenSearchStack', {
  stackName: 'slaops-opensearch',
  description: 'SLAOps OpenSearch Infrastructure - OpenSearch domain cluster',
  env,
  tags,
  singleNodeMode: process.env.ENVIRONMENT === 'development' || process.env.ENVIRONMENT === 'dev',
})

// OpenSearch stack depends on VPC stack and Security Group stack
opensearchStack.addDependency(vpcStack)
opensearchStack.addDependency(securityGroupStack)

// OpenAPI Bucket infrastructure stack
// Contains S3 bucket for storing OpenAPI specifications (APIs-guru format)
new OpenApiBucketStack(app, 'SlaOpsOpenApiBucketStack', {
  stackName: 'slaops-openapi-bucket',
  description: 'SLAOps OpenAPI Bucket - S3 bucket for OpenAPI specifications',
  env,
  tags,
})

// API Gateway infrastructure stack
// Contains REST API that proxies to the Lambda function deployed by Amplify
// NOTE: Deploy Amplify backend first to create the Lambda function,
//       then deploy this stack with the Lambda ARN
const lambdaFunctionArn =
  process.env.LAMBDA_FUNCTION_ARN || app.node.tryGetContext('lambdaFunctionArn')

if (lambdaFunctionArn) {
  new ApiStack(app, 'SlaOpsApiStack', {
    stackName: 'slaops-api-infrastructure',
    description: 'SLAOps API Infrastructure - API Gateway REST API',
    env,
    tags,
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
