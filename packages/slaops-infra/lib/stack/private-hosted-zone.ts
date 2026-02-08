import { CfnOutput, Fn, Stack, StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as route53 from 'aws-cdk-lib/aws-route53'
import { Construct } from 'constructs'

/**
 * Props for HostedZoneStack
 */
export interface HostedZoneStackProps extends StackProps {
  /**
   * Domain name for the private hosted zone
   * @default '${env}.internal.slaops.com' (where env comes from ENVIRONMENT env var or 'production')
   */
  zoneName?: string
}

/**
 * Infrastructure stack for SLAOps private hosted zone
 *
 * This stack contains:
 * - Route53 private hosted zone associated with the VPC
 * - DNS resolution for resources within the VPC
 *
 * VPC resources are imported from the VPC stack via CloudFormation exports.
 *
 * The hosted zone ID is exported via CloudFormation output and can be
 * referenced by other stacks.
 */
export class HostedZoneStack extends Stack {
  public readonly hostedZone: route53.PrivateHostedZone

  constructor(scope: Construct, id: string, props?: HostedZoneStackProps) {
    super(scope, id, props)

    // Import VPC ID from the VPC stack using CloudFormation exports
    // Only VPC ID is needed for creating a private hosted zone
    const vpcId = Fn.importValue('slaops-vpc-id')

    // Create a minimal VPC reference - only VPC ID is needed for hosted zone
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
      vpcId,
      availabilityZones: Fn.getAzs(), // Required by fromVpcAttributes
    })

    // Get environment from ENVIRONMENT env var or default to 'production'
    const environment = process.env.ENVIRONMENT || 'production'
    const defaultZoneName = `${environment}.internal.slaops.com`
    const zoneName = props?.zoneName ?? defaultZoneName

    // Create private hosted zone associated with the VPC
    this.hostedZone = new route53.PrivateHostedZone(this, 'SlaOpsHostedZone', {
      zoneName,
      vpc,
    })

    // Export hosted zone ID via CloudFormation output
    new CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Private hosted zone ID',
      exportName: 'slaops-hosted-zone-id',
    })

    // Also export the zone name for convenience
    new CfnOutput(this, 'HostedZoneName', {
      value: this.hostedZone.zoneName,
      description: 'Private hosted zone name',
      exportName: 'slaops-hosted-zone-name',
    })
  }
}
