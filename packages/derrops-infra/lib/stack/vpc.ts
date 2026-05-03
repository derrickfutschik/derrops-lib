import { CfnOutput, Stack, Tags, StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

/**
 * Props for VpcStack with configurable networking features
 */
export interface VpcStackProps extends StackProps {
  /**
   * Number of NAT Gateways to create (1-3)
   * - 1: Cost-optimized for dev/staging (single point of failure)
   * - 2: Balance between cost and availability
   * - 3: High availability (one per AZ, recommended for production)
   * @default 1
   */
  natGatewayCount?: number

  /**
   * Enable VPC Flow Logs for network traffic monitoring
   * @default false
   */
  enableFlowLogs?: boolean

  /**
   * Enable S3 Gateway Endpoint (FREE - eliminates NAT costs for S3)
   * @default false
   */
  enableS3Endpoint?: boolean

  /**
   * Enable DynamoDB Gateway Endpoint (FREE - eliminates NAT costs for DynamoDB)
   * @default false
   */
  enableDynamoDbEndpoint?: boolean

  /**
   * Enable Secrets Manager Interface Endpoint (~$7.20/month)
   * Recommended for secure database credential access
   * @default false
   */
  enableSecretsManagerEndpoint?: boolean

  /**
   * Enable CloudWatch Logs Interface Endpoint (~$7.20/month)
   * Reduces NAT costs for Lambda and service logging
   * @default false
   */
  enableCloudWatchLogsEndpoint?: boolean

  /**
   * Enable EC2 Interface Endpoint (~$7.20/month)
   * Faster Lambda cold starts via improved ENI management
   * @default false
   */
  enableEc2Endpoint?: boolean

  /**
   * Enable ECR API Interface Endpoint (~$7.20/month)
   * For container registry API calls
   * @default false
   */
  enableEcrApiEndpoint?: boolean

  /**
   * Enable ECR Docker Interface Endpoint (~$7.20/month)
   * For Docker image pulls from ECR
   * @default false
   */
  enableEcrDockerEndpoint?: boolean
}

/**
 * Infrastructure stack for Derrops VPC resources
 *
 * This stack contains the VPC networking infrastructure:
 * - VPC with 3 availability zones
 * - 3 public subnets (one per AZ)
 * - 3 private subnets with NAT egress (one per AZ)
 * - 3 isolated subnets for databases (one per AZ)
 * - Configurable NAT gateways (1-3) for internet access
 * - Optional VPC endpoints (S3, DynamoDB, Secrets Manager, CloudWatch Logs, EC2, ECR)
 * - Optional VPC Flow Logs for network monitoring
 *
 * All resources are exported via CloudFormation outputs and can be
 * referenced by other stacks.
 */
export class VpcStack extends Stack {
  public readonly vpc: ec2.Vpc
  public readonly publicSubnets: ec2.ISubnet[]
  public readonly privateSubnets: ec2.ISubnet[]

  constructor(scope: Construct, id: string, props?: VpcStackProps) {
    super(scope, id, props)

    Tags.of(this).add('derrops:domain', 'platform')
    Tags.of(this).add('derrops:service', 'vpc')

    // Get configurable NAT Gateway count (default: 1)
    const natGateways = props?.natGatewayCount ?? 1

    // Create VPC with 3 availability zones
    this.vpc = new ec2.Vpc(this, 'DerropsVpc', {
      maxAzs: 3,
      natGateways,
      enableDnsHostnames: true, // Required for RDS/OpenSearch/VPC endpoints
      enableDnsSupport: true, // Required for private DNS resolution
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    })

    this.publicSubnets = this.vpc.publicSubnets
    this.privateSubnets = this.vpc.privateSubnets

    // Gateway Endpoints (FREE - no additional cost, reduces NAT charges)
    if (props?.enableS3Endpoint ?? false) {
      this.vpc.addGatewayEndpoint('S3Endpoint', {
        service: ec2.GatewayVpcEndpointAwsService.S3,
      })
    }

    if (props?.enableDynamoDbEndpoint ?? false) {
      this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
        service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      })
    }

    // Interface Endpoints (require security group)
    const needsEndpointSecurityGroup =
      (props?.enableSecretsManagerEndpoint ?? false) ||
      (props?.enableCloudWatchLogsEndpoint ?? false) ||
      (props?.enableEc2Endpoint ?? false) ||
      (props?.enableEcrApiEndpoint ?? false) ||
      (props?.enableEcrDockerEndpoint ?? false)

    if (needsEndpointSecurityGroup) {
      const endpointSecurityGroup = new ec2.SecurityGroup(this, 'VpcEndpointSecurityGroup', {
        vpc: this.vpc,
        description: 'Security group for VPC interface endpoints',
        allowAllOutbound: true,
      })

      endpointSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
        ec2.Port.tcp(443),
        'Allow HTTPS from VPC',
      )

      if (props?.enableSecretsManagerEndpoint ?? false) {
        this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
          service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
          privateDnsEnabled: true,
          subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          securityGroups: [endpointSecurityGroup],
        })
      }

      if (props?.enableCloudWatchLogsEndpoint ?? false) {
        this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
          service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
          privateDnsEnabled: true,
          subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          securityGroups: [endpointSecurityGroup],
        })
      }

      if (props?.enableEc2Endpoint ?? false) {
        this.vpc.addInterfaceEndpoint('EC2Endpoint', {
          service: ec2.InterfaceVpcEndpointAwsService.EC2,
          privateDnsEnabled: true,
          subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          securityGroups: [endpointSecurityGroup],
        })
      }

      if (props?.enableEcrApiEndpoint ?? false) {
        this.vpc.addInterfaceEndpoint('EcrApiEndpoint', {
          service: ec2.InterfaceVpcEndpointAwsService.ECR,
          privateDnsEnabled: true,
          subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          securityGroups: [endpointSecurityGroup],
        })
      }

      if (props?.enableEcrDockerEndpoint ?? false) {
        this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
          service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
          privateDnsEnabled: true,
          subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          securityGroups: [endpointSecurityGroup],
        })
      }
    }

    if (props?.enableFlowLogs ?? false) {
      new ec2.FlowLog(this, 'VpcFlowLog', {
        resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
        trafficType: ec2.FlowLogTrafficType.ALL,
        flowLogName: 'derrops--platform--vpc--flow-log',
      })
    }

    // Export VPC outputs
    new CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'derrops--platform--vpc--id',
    })

    new CfnOutput(this, 'VpcCidrBlock', {
      value: this.vpc.vpcCidrBlock,
      description: 'VPC CIDR block',
      exportName: 'derrops--platform--vpc--cidr-block',
    })

    this.publicSubnets.forEach((subnet, index) => {
      const azLetter = this.vpc.availabilityZones[index].slice(-1).toLowerCase()
      new CfnOutput(this, `PublicSubnet${azLetter.toUpperCase()}Id`, {
        value: subnet.subnetId,
        description: `Public subnet ${azLetter.toUpperCase()} ID`,
        exportName: `derrops--platform--vpc--subnet-public-${azLetter}`,
      })
    })

    this.privateSubnets.forEach((subnet, index) => {
      const azLetter = this.vpc.availabilityZones[index].slice(-1).toLowerCase()
      new CfnOutput(this, `PrivateSubnet${azLetter.toUpperCase()}Id`, {
        value: subnet.subnetId,
        description: `Private subnet ${azLetter.toUpperCase()} ID`,
        exportName: `derrops--platform--vpc--subnet-private-${azLetter}`,
      })
    })

    this.vpc.isolatedSubnets.forEach((subnet, index) => {
      const azLetter = this.vpc.availabilityZones[index].slice(-1).toLowerCase()
      new CfnOutput(this, `IsolatedSubnet${azLetter.toUpperCase()}Id`, {
        value: subnet.subnetId,
        description: `Isolated subnet ${azLetter.toUpperCase()} ID`,
        exportName: `derrops--platform--vpc--subnet-isolated-${azLetter}`,
      })
    })
  }
}
