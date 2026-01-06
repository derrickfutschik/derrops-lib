import { defineBackend } from '@aws-amplify/backend';
import { api } from './functions/api/resource';
import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';

// Define backend with only the Lambda function
// Database, auth, and API Gateway are managed in @slaops/infra package
const backend = defineBackend({
  api,
});

// Access the Lambda function's underlying stack and the Lambda function itself
const lambdaStack = backend.api.resources.lambda.stack;
const lambdaFunction = backend.api.resources.lambda as lambda.Function;

// Import infrastructure stack outputs
const dbEndpoint = cdk.Fn.importValue('SlaOpsDbClusterEndpoint');
const dbSecretArn = cdk.Fn.importValue('SlaOpsDbSecretArn');
const userPoolId = cdk.Fn.importValue('SlaOpsUserPoolId');

// Get reference to the database secret
const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(
  lambdaStack,
  'DatabaseSecret',
  dbSecretArn,
);

// Grant the Lambda function read access to the database secret
dbSecret.grantRead(backend.api.resources.lambda);

// Import VPC and security group from infrastructure stack
const vpcId = cdk.Fn.importValue('slaops-vpc-id');
const cloudSecurityGroupId = cdk.Fn.importValue('slaops-cloud-sg-id');

// Import private subnet IDs (use all 3 AZs for high availability)
const privateSubnetIds = [
  cdk.Fn.importValue('slaops-vpc-subnet-private-a'),
  cdk.Fn.importValue('slaops-vpc-subnet-private-b'),
  cdk.Fn.importValue('slaops-vpc-subnet-private-c'),
];

// Add Lambda to VPC with the security group
// Use the CFN-level API to configure VPC as Amplify doesn't support it directly
const cfnFunction = lambdaFunction.node.defaultChild as lambda.CfnFunction;
cfnFunction.vpcConfig = {
  subnetIds: privateSubnetIds,
  securityGroupIds: [cloudSecurityGroupId],
};

// Add environment variables using the addEnvironment method from Amplify backend
backend.api.addEnvironment('DB_HOST', dbEndpoint);
backend.api.addEnvironment('DB_SECRET_ARN', dbSecretArn);
backend.api.addEnvironment('USER_POOL_ID', userPoolId);

// Export the Lambda function ARN so the API Gateway in @slaops/infra can reference it
new cdk.CfnOutput(lambdaStack, 'LambdaFunctionArn', {
  value: backend.api.resources.lambda.functionArn,
  description: 'ARN of the NestJS API Lambda function',
  exportName: 'SlaOpsLambdaFunctionArn',
});

new cdk.CfnOutput(lambdaStack, 'LambdaFunctionName', {
  value: backend.api.resources.lambda.functionName,
  description: 'Name of the NestJS API Lambda function',
  exportName: 'SlaOpsLambdaFunctionName',
});

export { backend };

