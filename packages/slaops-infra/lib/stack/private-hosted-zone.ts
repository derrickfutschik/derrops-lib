import { CfnOutput, Fn, Stack, Tags, StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as route53 from 'aws-cdk-lib/aws-route53'
import { Construct } from 'constructs'

/**
 * Props for HostedZoneStack
 */
export interface HostedZoneStackProps extends StackProps {
  /**
   * Domain name for the private hosted zone
   * @default '${env}.internal.slaops.com' (where env comes from ENVIRONMENT env var or 'prod')
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

    Tags.of(this).add('slaops:domain', 'platform')
    Tags.of(this).add('slaops:service', 'dns')

    const vpcId = Fn.importValue('slaops--platform--vpc--id')

    const vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
      vpcId,
      availabilityZones: Fn.getAzs(),
    })

    const environment = process.env.ENVIRONMENT || 'prod'
    const defaultZoneName = `${environment}.internal.slaops.com`
    const zoneName = props?.zoneName ?? defaultZoneName

    this.hostedZone = new route53.PrivateHostedZone(this, 'SlaOpsHostedZone', {
      zoneName,
      vpc,
    })

    new CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Private hosted zone ID',
      exportName: 'slaops--platform--dns--hosted-zone-id',
    })

    new CfnOutput(this, 'HostedZoneName', {
      value: this.hostedZone.zoneName,
      description: 'Private hosted zone name',
      exportName: 'slaops--platform--dns--hosted-zone-name',
    })
  }
}
