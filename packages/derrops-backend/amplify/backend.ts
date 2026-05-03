import { defineBackend } from '@aws-amplify/backend'
import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3n from 'aws-cdk-lib/aws-s3-notifications'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { config } from '@derrops/config'
import { api } from './functions/api/resource'
import { openapiIndexer } from './functions/openapi-indexer/resource'

// Define backend with the API Lambda and OpenAPI Indexer Lambda
// Database, auth, and API Gateway are managed in @derrops/infra package
const backend = defineBackend({
  api,
  openapiIndexer,
})

// Access the Lambda function's underlying stack and the Lambda function itself
const lambdaStack = backend.api.resources.lambda.stack
const lambdaFunction = backend.api.resources.lambda as lambda.Function

// Import infrastructure stack outputs
const dbEndpoint = cdk.Fn.importValue('derrops--platform--app-database--cluster-endpoint')
const dbSecretArn = cdk.Fn.importValue('derrops--platform--app-database--secret-arn')
const userPoolId = cdk.Fn.importValue('derrops--auth--cognito--user-pool-id')

// Get reference to the database secret
const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(
  lambdaStack,
  'DatabaseSecret',
  dbSecretArn,
)

// Grant the Lambda function read access to the database secret
dbSecret.grantRead(backend.api.resources.lambda)

// Import VPC and security group from infrastructure stack
const vpcId = cdk.Fn.importValue('derrops--platform--vpc--id')
const cloudSecurityGroupId = cdk.Fn.importValue('derrops--platform--cloud--sg-id')

// Import private subnet IDs (use all 3 AZs for high availability)
const privateSubnetIds = [
  cdk.Fn.importValue('derrops--platform--vpc--subnet-private-a'),
  cdk.Fn.importValue('derrops--platform--vpc--subnet-private-b'),
  cdk.Fn.importValue('derrops--platform--vpc--subnet-private-c'),
]

// Add Lambda to VPC with the security group
// Use the CFN-level API to configure VPC as Amplify doesn't support it directly
const cfnFunction = lambdaFunction.node.defaultChild as lambda.CfnFunction
cfnFunction.vpcConfig = {
  subnetIds: privateSubnetIds,
  securityGroupIds: [cloudSecurityGroupId],
}

// Import OpenSearch endpoint for the API Lambda (search service)
const opensearchEndpointForApi = cdk.Fn.importValue(
  'derrops--platform--opensearch--collection-endpoint',
)
const opensearchCollectionArnForApi = cdk.Fn.importValue(
  'derrops--platform--opensearch--collection-arn',
)

// Add environment variables using the addEnvironment method from Amplify backend
backend.api.addEnvironment('DB_HOST', dbEndpoint)
backend.api.addEnvironment('DB_SECRET_ARN', dbSecretArn)
backend.api.addEnvironment('USER_POOL_ID', userPoolId)
backend.api.addEnvironment('OPENSEARCH_ENDPOINT', opensearchEndpointForApi)
backend.api.addEnvironment('OPENSEARCH_INDEX_NAME', 'derrops-openapis')

// Grant the API Lambda access to OpenSearch Serverless (for search service)
backend.api.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['aoss:APIAccessAll'],
    resources: [opensearchCollectionArnForApi],
  }),
)

// Export the Lambda function ARN so the API Gateway in @derrops/infra can reference it
new cdk.CfnOutput(lambdaStack, 'LambdaFunctionArn', {
  value: backend.api.resources.lambda.functionArn,
  description: 'ARN of the NestJS API Lambda function',
  exportName: 'derrops--platform--api--lambda-arn',
})

new cdk.CfnOutput(lambdaStack, 'LambdaFunctionName', {
  value: backend.api.resources.lambda.functionName,
  description: 'Name of the NestJS API Lambda function',
  exportName: 'derrops--platform--api--lambda-name',
})

// ============================================================================
// OpenAPI Indexer Lambda Configuration
// ============================================================================

// Access the indexer Lambda's stack and function
const indexerStack = backend.openapiIndexer.resources.lambda.stack
const indexerFunction = backend.openapiIndexer.resources.lambda

// Import infrastructure stack outputs
const opensearchEndpoint = cdk.Fn.importValue('derrops--platform--opensearch--collection-endpoint')
const opensearchCollectionArn = cdk.Fn.importValue('derrops--platform--opensearch--collection-arn')
const openapiBucketArn = cdk.Fn.importValue('derrops--oaspec--source--bucket-arn')
const openapiBucketName = cdk.Fn.importValue('derrops--oaspec--source--bucket-name')

// Reference the S3 bucket from the infra stack
const openapiBucket = s3.Bucket.fromBucketAttributes(indexerStack, 'OpenApiBucket', {
  bucketArn: openapiBucketArn,
  bucketName: openapiBucketName,
})

// Grant the indexer Lambda read access to the S3 bucket
openapiBucket.grantRead(indexerFunction)

// Grant the indexer Lambda access to OpenSearch Serverless
indexerFunction.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['aoss:APIAccessAll'],
    resources: [opensearchCollectionArn],
  }),
)

// Add environment variables for the indexer Lambda
backend.openapiIndexer.addEnvironment('OPENSEARCH_ENDPOINT', opensearchEndpoint)
backend.openapiIndexer.addEnvironment('OPENSEARCH_INDEX_NAME', 'derrops-openapis')

// Configure the indexer Lambda to run in the VPC (for OpenSearch Serverless access)
const indexerCfnFunction = indexerFunction.node.defaultChild as lambda.CfnFunction
indexerCfnFunction.vpcConfig = {
  subnetIds: privateSubnetIds,
  securityGroupIds: [cloudSecurityGroupId],
}

// Add S3 event notification to trigger the Lambda on object creation
openapiBucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(indexerFunction),
  { prefix: 'APIs/' }, // Only trigger for objects in APIs/ prefix
)

// Add S3 event notification for object deletion
openapiBucket.addEventNotification(
  s3.EventType.OBJECT_REMOVED,
  new s3n.LambdaDestination(indexerFunction),
  { prefix: 'APIs/' },
)

// Export indexer Lambda function ARN
new cdk.CfnOutput(indexerStack, 'IndexerLambdaFunctionArn', {
  value: indexerFunction.functionArn,
  description: 'ARN of the OpenAPI Indexer Lambda function',
  exportName: 'derrops--oaspec--indexer--lambda-arn',
})

// ============================================================================
// OASpec S3 Buckets
// ============================================================================

// OASpec Storage Bucket — persistent store for validated OpenAPI specs
const oaspecStorageBucket = new s3.Bucket(indexerStack, 'OaspecStorageBucket', {
  bucketName: config['derrops.oaspec.storage.bucket'],
  versioned: true,
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
})

// OASpec Staging Bucket — temporary landing zone for incoming OASpec uploads
const oaspecStagingBucket = new s3.Bucket(indexerStack, 'OaspecStagingBucket', {
  bucketName: config['derrops.oaspec.staging.bucket'],
  versioned: false,
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
})

// Grant the API Lambda read access to the storage bucket
oaspecStorageBucket.grantRead(lambdaFunction)

// Grant the indexer Lambda read/write access to both buckets
oaspecStorageBucket.grantReadWrite(indexerFunction)
oaspecStagingBucket.grantReadWrite(indexerFunction)

// Expose bucket names as environment variables on both Lambdas
backend.api.addEnvironment('OASPEC_STORAGE_BUCKET', oaspecStorageBucket.bucketName)
backend.openapiIndexer.addEnvironment('OASPEC_STORAGE_BUCKET', oaspecStorageBucket.bucketName)
backend.openapiIndexer.addEnvironment('OASPEC_STAGING_BUCKET', oaspecStagingBucket.bucketName)

// Export bucket names for cross-stack references
new cdk.CfnOutput(indexerStack, 'OaspecStorageBucketName', {
  value: oaspecStorageBucket.bucketName,
  description: 'Name of the OASpec storage bucket',
  exportName: 'derrops--oaspec--storage--bucket-name',
})

new cdk.CfnOutput(indexerStack, 'OaspecStagingBucketName', {
  value: oaspecStagingBucket.bucketName,
  description: 'Name of the OASpec staging bucket',
  exportName: 'derrops--oaspec--staging--bucket-name',
})

export { backend }
