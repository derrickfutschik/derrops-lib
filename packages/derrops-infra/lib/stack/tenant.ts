import { RemovalPolicy, StackProps, Tags } from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import { DerropsConventions } from '@derrops-conventions'
import { DerropsStack } from './derrops-stack'

/**
 * Infrastructure stack for per-tenant dedicated resources.
 *
 * Currently provisions an S3 bucket for tenant-scoped specification storage.
 *
 * pnpm --filter @derrops/infra run cdk deploy DerropsTenantStack
 */
export class TenantStack extends DerropsStack {
  public readonly specBucket: s3.Bucket

  constructor(conventions: DerropsConventions, scope: Construct, id: string, props?: StackProps) {
    super(conventions, scope, id, props)

    const conv = {
      specBucket: this.resource({ type: 's3Bucket', key: 'spec' }),
    }

    // -------------------------------------------------------------------------
    // Tenant specification bucket
    // -------------------------------------------------------------------------
    this.specBucket = new s3.Bucket(this, 'TenantSpecBucket', {
      bucketName: conv.specBucket.name,
      versioned: true,

      // TODO - consider using KMS key for encryption
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
    })

    conv.specBucket.applyTags((k, v) => Tags.of(this.specBucket).add(k, v))
  }
}
