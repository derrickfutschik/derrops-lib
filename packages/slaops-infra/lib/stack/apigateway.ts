import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Infrastructure stack for SLAOps API Gateway
 *
 * This stack contains the API Gateway REST API that serves as the entry
 * point for the SLAOps platform. It proxies all requests to the Lambda
 * function deployed by the Amplify backend.
 *
 * Features:
 * - REST API with CORS support
 * - Rate limiting and throttling
 * - Lambda proxy integration
 * - CloudWatch logging
 *
 * The Lambda function is deployed separately via Amplify and referenced
 * here via CloudFormation import.
 */
export class ApiStack extends Stack {
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Import the Lambda function ARN from Amplify backend stack
    // This will be set after the Amplify backend is deployed
    const lambdaFunctionArn = this.node.tryGetContext('lambdaFunctionArn') ||
      process.env.LAMBDA_FUNCTION_ARN;

    if (!lambdaFunctionArn) {
      throw new Error(
        'Lambda function ARN not provided. ' +
        'Deploy Amplify backend first, then set LAMBDA_FUNCTION_ARN env variable ' +
        'or pass lambdaFunctionArn context parameter.'
      );
    }

    // Import the Lambda function by ARN
    const apiFunction = lambda.Function.fromFunctionArn(
      this,
      'ApiFunction',
      lambdaFunctionArn,
    );

    // Create API Gateway REST API
    this.restApi = new apigateway.RestApi(this, 'SlaOpsRestApi', {
      restApiName: 'SLAOps API',
      description: 'SLAOps Cloud Backend REST API',
      deployOptions: {
        stageName: 'prod',
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: process.env.CORS_ORIGINS?.split(',') || apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Requested-With',
        ],
        allowCredentials: true,
      },
      cloudWatchRole: true,
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
    });

    // Create Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(apiFunction, {
      proxy: true,
      allowTestInvoke: true,
      integrationResponses: [
        {
          statusCode: '200',
        },
      ],
    });

    // Add proxy resource to handle all paths
    this.restApi.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // Also add root endpoint
    this.restApi.root.addMethod('ANY', lambdaIntegration);

    // Export API outputs
    new CfnOutput(this, 'ApiUrl', {
      value: this.restApi.url,
      description: 'SLAOps REST API URL',
      exportName: 'SlaOpsApiUrl',
    });

    new CfnOutput(this, 'ApiId', {
      value: this.restApi.restApiId,
      description: 'SLAOps REST API ID',
      exportName: 'SlaOpsApiId',
    });

    new CfnOutput(this, 'ApiArn', {
      value: this.restApi.arnForExecuteApi(),
      description: 'SLAOps REST API ARN',
      exportName: 'SlaOpsApiArn',
    });

    new CfnOutput(this, 'ApiEndpoint', {
      value: `${this.restApi.url}prod`,
      description: 'SLAOps REST API Endpoint (with stage)',
      exportName: 'SlaOpsApiEndpoint',
    });
  }
}
