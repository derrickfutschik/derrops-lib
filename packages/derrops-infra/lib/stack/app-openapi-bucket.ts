import { CfnOutput, RemovalPolicy, Stack, Tags, StackProps } from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

/**
 * Props for OpenApiBucketStack
 */
export interface OpenApiBucketStackProps extends StackProps {
  /**
   * Enable versioning on the bucket
   * @default true
   */
  versioned?: boolean
}

/**
 * Infrastructure stack for the Derrops-managed OpenAPI source bucket
 *
 * This stack creates the S3 bucket that holds Derrops-managed OpenAPI
 * specifications (sourced from APIs-guru and curated additions), structured
 * as the APIs-guru directory layout:
 *   APIs/{provider}/{service}/{version}/openapi.{yaml|json}
 *
 * Bucket name follows the Derrops globally-unique convention:
 *   {region}--{env}--{org}--{tenant}--{domain}--{service}--{key}
 * where tenant = "derrops" (the platform's own reserved tenant ID).
 *
 * The bucket exports its ARN and name for use by the Amplify backend indexer Lambda.
 */
export class OpenApiBucketStack extends Stack {
  public readonly bucket: s3.Bucket

  constructor(scope: Construct, id: string, props?: OpenApiBucketStackProps) {
    super(scope, id, props)

    Tags.of(this).add('derrops:domain', 'oaspec')
    Tags.of(this).add('derrops:service', 'source')
    Tags.of(this).add('derrops:tenant-id', 'derrops')

    const appEnv = process.env.ENVIRONMENT || 'prod'

    this.bucket = new s3.Bucket(this, 'OpenApiSourceBucket', {
      // Globally-unique name: {region}--{env}--derrops--derrops--oaspec--source--specs
      bucketName: `${this.region}--${appEnv}--derrops--derrops--oaspec--source--specs`,
      versioned: props?.versioned ?? true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      eventBridgeEnabled: true,
    })

    new CfnOutput(this, 'OpenApiSourceBucketArn', {
      value: this.bucket.bucketArn,
      description: 'ARN of the Derrops-managed OpenAPI source S3 bucket',
      exportName: 'derrops--oaspec--source--bucket-arn',
    })

    new CfnOutput(this, 'OpenApiSourceBucketName', {
      value: this.bucket.bucketName,
      description: 'Name of the Derrops-managed OpenAPI source S3 bucket',
      exportName: 'derrops--oaspec--source--bucket-name',
    })
  }
}
