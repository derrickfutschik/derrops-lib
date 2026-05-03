import { CfnOutput, Fn, Stack, Tags, StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

/**
 * Infrastructure stack for Derrops centralized security groups
 *
 * This stack contains security groups for:
 * - OpenSearch domain
 * - RDS database (PostgreSQL)
 * - Lambda backend function
 * - Amplify backend (cloud)
 *
 * VPC resources are imported from the VPC stack via CloudFormation exports.
 *
 * These security groups are exported via CloudFormation outputs and can be
 * referenced by other stacks.
 */
export class SecurityGroupStack extends Stack {
  public readonly opensearchSecurityGroup: ec2.SecurityGroup
  public readonly rdsSecurityGroup: ec2.SecurityGroup
  public readonly backendSecurityGroup: ec2.SecurityGroup
  public readonly cloudSecurityGroup: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    Tags.of(this).add('derrops:domain', 'platform')
    Tags.of(this).add('derrops:service', 'security-groups')

    const vpcId = Fn.importValue('derrops--platform--vpc--id')

    const vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
      vpcId,
      availabilityZones: Fn.getAzs(),
    })

    this.opensearchSecurityGroup = new ec2.SecurityGroup(this, 'DerropsOpenSearchSecurityGroup', {
      vpc,
      description: 'Security group for Derrops OpenSearch domain',
      allowAllOutbound: true,
      securityGroupName: 'derrops--platform--opensearch--sg',
    })

    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'DerropsRdsSecurityGroup', {
      vpc,
      description: 'Security group for Derrops RDS PostgreSQL database',
      allowAllOutbound: true,
      securityGroupName: 'derrops--platform--app-database--sg',
    })

    this.backendSecurityGroup = new ec2.SecurityGroup(this, 'DerropsBackendSecurityGroup', {
      vpc,
      description: 'Security group for Derrops backend Lambda function',
      allowAllOutbound: true,
      securityGroupName: 'derrops--platform--backend--sg',
    })

    this.cloudSecurityGroup = new ec2.SecurityGroup(this, 'DerropsCloudSecurityGroup', {
      vpc,
      description: 'Security group for Derrops Amplify backend',
      allowAllOutbound: true,
      securityGroupName: 'derrops--platform--cloud--sg',
    })

    // Allow Lambda backend to access OpenSearch (HTTPS port 443)
    this.opensearchSecurityGroup.addIngressRule(
      this.backendSecurityGroup,
      ec2.Port.tcp(443),
      'Allow HTTPS access from Lambda backend',
    )

    // Allow Lambda backend to access RDS (PostgreSQL port 5432)
    this.rdsSecurityGroup.addIngressRule(
      this.backendSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from Lambda backend',
    )

    // Allow Amplify backend to access RDS (PostgreSQL port 5432)
    this.rdsSecurityGroup.addIngressRule(
      this.cloudSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from Amplify backend',
    )

    new CfnOutput(this, 'OpenSearchSecurityGroupId', {
      value: this.opensearchSecurityGroup.securityGroupId,
      description: 'Security group ID for OpenSearch domain',
      exportName: 'derrops--platform--opensearch--sg-id',
    })

    new CfnOutput(this, 'RdsSecurityGroupId', {
      value: this.rdsSecurityGroup.securityGroupId,
      description: 'Security group ID for RDS database',
      exportName: 'derrops--platform--app-database--sg-id',
    })

    new CfnOutput(this, 'BackendSecurityGroupId', {
      value: this.backendSecurityGroup.securityGroupId,
      description: 'Security group ID for Lambda backend',
      exportName: 'derrops--platform--backend--sg-id',
    })

    new CfnOutput(this, 'CloudSecurityGroupId', {
      value: this.cloudSecurityGroup.securityGroupId,
      description: 'Security group ID for Amplify backend',
      exportName: 'derrops--platform--cloud--sg-id',
    })
  }
}
