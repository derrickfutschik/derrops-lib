import { defineBackend } from '@aws-amplify/backend';
import { api } from './functions/api/resource';
import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

// Define backend with only the Lambda function
// Database, auth, and API Gateway are managed in @slaops/infra package
const backend = defineBackend({
  api,
});

// Access the Lambda function's underlying stack
const lambdaStack = backend.api.resources.lambda.stack;

// Import infrastructure stack outputs
const dbEndpoint = cdk.Fn.importValue('SlaOpsDbClusterEndpoint');
const dbSecretArn = cdk.Fn.importValue('SlaOpsDbClusterSecretArn');
const userPoolId = cdk.Fn.importValue('SlaOpsUserPoolId');

// Get reference to the database secret
const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(
  lambdaStack,
  'DatabaseSecret',
  dbSecretArn,
);

// Grant the Lambda function read access to the database secret
dbSecret.grantRead(backend.api.resources.lambda);

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

