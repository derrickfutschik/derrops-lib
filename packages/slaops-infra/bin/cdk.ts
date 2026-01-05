#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/stack/userpool';
import { DatabaseStack } from '../lib/stack/database';
import { ApiStack } from '../lib/stack/apigateway';
import { SecurityGroupStack } from '../lib/stack/security-group';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',
};

const tags = {
  Project: 'SLAOps',
  Environment: process.env.ENVIRONMENT || 'production',
  ManagedBy: 'CDK',
  Stack: 'Infrastructure',
};

// Authentication infrastructure stack
// Contains Cognito User Pool and related auth resources
new AuthStack(app, 'SlaOpsAuthStack', {
  stackName: 'slaops-auth-infrastructure',
  description: 'SLAOps Authentication Infrastructure - Cognito User Pool',
  env,
  tags,
});

// Database infrastructure stack
// Contains Aurora Serverless v2, VPC, and networking resources
const databaseStack = new DatabaseStack(app, 'SlaOpsDatabaseStack', {
  stackName: 'slaops-database-infrastructure',
  description: 'SLAOps Database Infrastructure - Aurora Serverless v2 PostgreSQL with VPC',
  env,
  tags,
});

// Security Group infrastructure stack
// Contains centralized security groups for OpenSearch, RDS, and Lambda backend
const securityGroupStack = new SecurityGroupStack(app, 'SlaOpsSecurityGroupStack', {
  stackName: 'slaops-security-group-infrastructure',
  description: 'SLAOps Security Group Infrastructure - Centralized security groups',
  vpc: databaseStack.vpc,
  env,
  tags,
});

// Security group stack depends on database stack (for VPC)
securityGroupStack.addDependency(databaseStack);

// API Gateway infrastructure stack
// Contains REST API that proxies to the Lambda function deployed by Amplify
// NOTE: Deploy Amplify backend first to create the Lambda function,
//       then deploy this stack with the Lambda ARN
const lambdaFunctionArn = process.env.LAMBDA_FUNCTION_ARN ||
  app.node.tryGetContext('lambdaFunctionArn');

if (lambdaFunctionArn) {
  new ApiStack(app, 'SlaOpsApiStack', {
    stackName: 'slaops-api-infrastructure',
    description: 'SLAOps API Infrastructure - API Gateway REST API',
    env,
    tags,
  });
} else {
  console.warn(
    '\n⚠️  WARNING: Lambda function ARN not provided. Skipping API stack deployment.\n' +
    '   To deploy the API stack:\n' +
    '   1. Deploy Amplify backend first: pnpm amplify:deploy\n' +
    '   2. Get Lambda ARN from Amplify outputs\n' +
    '   3. Deploy with: LAMBDA_FUNCTION_ARN=<arn> pnpm infra:deploy\n' +
    '   Or use: pnpm run cdk deploy --context lambdaFunctionArn=<arn>\n'
  );
}

app.synth();
