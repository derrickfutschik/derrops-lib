import { CfnOutput, Stack, Tags, StackProps } from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

/**
 * Infrastructure stack for Derrops API Gateway
 *
 * This stack contains the API Gateway REST API that serves as the entry
 * point for the Derrops platform. It proxies all requests to the Lambda
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
  public readonly restApi: apigateway.RestApi

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    Tags.of(this).add('derrops:domain', 'platform')
    Tags.of(this).add('derrops:service', 'api-gateway')

    const lambdaFunctionArn =
      this.node.tryGetContext('lambdaFunctionArn') || process.env.LAMBDA_FUNCTION_ARN

    if (!lambdaFunctionArn) {
      throw new Error(
        'Lambda function ARN not provided. ' +
          'Deploy Amplify backend first, then set LAMBDA_FUNCTION_ARN env variable ' +
          'or pass lambdaFunctionArn context parameter.',
      )
    }

    const apiFunction = lambda.Function.fromFunctionArn(this, 'ApiFunction', lambdaFunctionArn)

    this.restApi = new apigateway.RestApi(this, 'DerropsRestApi', {
      restApiName: 'derrops--platform--api-gateway',
      description: 'Derrops Cloud Backend REST API',
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
    })

    const lambdaIntegration = new apigateway.LambdaIntegration(apiFunction, {
      proxy: true,
      allowTestInvoke: true,
      integrationResponses: [
        {
          statusCode: '200',
        },
      ],
    })

    this.restApi.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    })

    this.restApi.root.addMethod('ANY', lambdaIntegration)

    new CfnOutput(this, 'ApiUrl', {
      value: this.restApi.url,
      description: 'Derrops REST API URL',
      exportName: 'derrops--platform--api-gateway--url',
    })

    new CfnOutput(this, 'ApiId', {
      value: this.restApi.restApiId,
      description: 'Derrops REST API ID',
      exportName: 'derrops--platform--api-gateway--id',
    })

    new CfnOutput(this, 'ApiArn', {
      value: this.restApi.arnForExecuteApi(),
      description: 'Derrops REST API ARN',
      exportName: 'derrops--platform--api-gateway--arn',
    })

    new CfnOutput(this, 'ApiEndpoint', {
      value: `${this.restApi.url}prod`,
      description: 'Derrops REST API Endpoint (with stage)',
      exportName: 'derrops--platform--api-gateway--endpoint',
    })
  }
}
