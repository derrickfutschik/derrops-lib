import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
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
 * Infrastructure stack for the OpenAPI specs S3 bucket
 *
 * This stack creates an S3 bucket for storing OpenAPI specifications
 * in the APIs-guru directory structure:
 *   APIs/{provider}/{service}/{version}/openapi.{yaml|json}
 *
 * The bucket exports its ARN and name for use by other stacks
 * (e.g., the Lambda indexer in slaops-backend).
 */
export class OpenApiBucketStack extends Stack {
  public readonly bucket: s3.Bucket

  constructor(scope: Construct, id: string, props?: OpenApiBucketStackProps) {
    super(scope, id, props)

    // Create S3 bucket for OpenAPI specs
    this.bucket = new s3.Bucket(this, 'OpenApiSpecsBucket', {
      bucketName: `slaops-openapi-specs-${this.account}-${this.region}`,
      versioned: props?.versioned ?? true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN, // Keep bucket on stack deletion
      // Enable event notifications (will be configured by slaops-backend)
      eventBridgeEnabled: true,
    })

    // Export bucket ARN
    new CfnOutput(this, 'OpenApiBucketArn', {
      value: this.bucket.bucketArn,
      description: 'ARN of the OpenAPI specs S3 bucket',
      exportName: 'slaops-openapi-bucket-arn',
    })

    // Export bucket name
    new CfnOutput(this, 'OpenApiBucketName', {
      value: this.bucket.bucketName,
      description: 'Name of the OpenAPI specs S3 bucket',
      exportName: 'slaops-openapi-bucket-name',
    })
  }
}
