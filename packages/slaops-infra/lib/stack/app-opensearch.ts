import { CfnOutput, Fn, Stack, StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless'
import { Construct } from 'constructs'

/**
 * Props for OpenSearchStack with configurable options
 */
export interface OpenSearchStackProps extends StackProps {
  /**
   * Enable single node mode for development (reduces costs)
   * @default false
   */
  singleNodeMode?: boolean
}

/**
 * Infrastructure stack for SLAOps OpenSearch Serverless resources
 *
 * This stack contains:
 * - OpenSearch Serverless collection
 * - Network security policy
 * - Data access policy
 *
 * VPC and networking resources are imported from the VPC stack.
 * Security group is imported from the Security Group stack.
 *
 * These resources are exported via CloudFormation outputs and can be
 * referenced by other stacks.
 */
export class OpenSearchStack extends Stack {
  public readonly vpc: ec2.IVpc
  public readonly collection: opensearchserverless.CfnCollection
  public readonly opensearchSecurityGroup: ec2.ISecurityGroup

  constructor(scope: Construct, id: string, props?: OpenSearchStackProps) {
    super(scope, id, props)

    // Import VPC ID from the VPC stack using CloudFormation exports
    const vpcId = Fn.importValue('slaops-vpc-id')

    // Import private subnet IDs (OpenSearch Serverless should be in private subnets)
    const privateSubnetIds = [
      Fn.importValue('slaops-vpc-subnet-private-a'),
      Fn.importValue('slaops-vpc-subnet-private-b'),
      Fn.importValue('slaops-vpc-subnet-private-c'),
    ]

    // Create minimal VPC reference
    this.vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
      vpcId,
      availabilityZones: Fn.getAzs(),
    })

    // Create subnet references
    const privateSubnets = privateSubnetIds.map((subnetId, index) =>
      ec2.Subnet.fromSubnetId(this, `PrivateSubnet${index}`, subnetId),
    )

    // Import security group from the Security Group stack
    const opensearchSecurityGroupId = Fn.importValue('slaops-opensearch-sg')
    this.opensearchSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ImportedOpenSearchSecurityGroup',
      opensearchSecurityGroupId,
    )

    // Create OpenSearch Serverless VPC endpoint
    // This enables private connectivity to the OpenSearch Serverless collection within the VPC
    const vpcEndpoint = new opensearchserverless.CfnVpcEndpoint(this, 'SlaOpsVpcEndpoint', {
      name: 'slaops-opensearch-vpc-endpoint',
      vpcId,
      subnetIds: privateSubnetIds,
      securityGroupIds: [opensearchSecurityGroupId],
    })

    // Create network security policy to allow VPC access
    // This policy allows the collection to be accessed from within the VPC
    // Must be created before the collection
    // Note: SourceVPCEs requires the actual VPC endpoint ID
    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'SlaOpsNetworkPolicy', {
      name: 'slaops-network-policy',
      type: 'network',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: ['collection/slaops-collection'],
            AllowFromPublic: false,
            SourceVPCEs: [vpcEndpoint.attrId],
          },
        ],
      }),
    })

    // Network policy depends on VPC endpoint
    networkPolicy.addDependency(vpcEndpoint)

    // Create OpenSearch Serverless collection
    // Associate it with the VPC endpoint for private VPC access
    this.collection = new opensearchserverless.CfnCollection(this, 'SlaOpsOpenSearchCollection', {
      name: 'slaops-collection',
      type: 'SEARCH', // Can be 'SEARCH', 'TIMESERIES', or 'VECTORSEARCH'
      description: 'SLAOps OpenSearch Serverless collection for log analytics',
    })

    // Network policy must be created before the collection
    this.collection.addDependency(networkPolicy)

    // Create data access policy (placeholder - should be configured based on IAM roles)
    // This allows specific IAM principals to access the collection
    const dataAccessPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      'SlaOpsDataAccessPolicy',
      {
        name: 'slaops-data-access-policy',
        type: 'data',
        policy: JSON.stringify({
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${this.collection.name}`],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DeleteCollectionItems',
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems',
              ],
              Principal: [
                // This should be replaced with actual IAM role ARNs
                // For now, using a placeholder that will need to be updated
                `arn:aws:iam::${this.account}:root`,
              ],
            },
            {
              ResourceType: 'index',
              Resource: [`index/${this.collection.name}/*`],
              Permission: [
                'aoss:CreateIndex',
                'aoss:DeleteIndex',
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument',
              ],
              Principal: [
                // This should be replaced with actual IAM role ARNs
                `arn:aws:iam::${this.account}:root`,
              ],
            },
          ],
        }),
      },
    )

    // Data access policy must be created after the collection
    dataAccessPolicy.addDependency(this.collection)

    // Export important values via CloudFormation outputs
    new CfnOutput(this, 'OpenSearchCollectionId', {
      value: this.collection.attrId,
      description: 'OpenSearch Serverless collection ID',
      exportName: 'slaops-opensearch-collection-id',
    })

    new CfnOutput(this, 'OpenSearchCollectionName', {
      value: this.collection.name,
      description: 'OpenSearch Serverless collection name',
      exportName: 'slaops-opensearch-collection-name',
    })

    new CfnOutput(this, 'OpenSearchCollectionArn', {
      value: this.collection.attrArn,
      description: 'OpenSearch Serverless collection ARN',
      exportName: 'slaops-opensearch-collection-arn',
    })

    new CfnOutput(this, 'OpenSearchCollectionEndpoint', {
      value: this.collection.attrCollectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
      exportName: 'slaops-opensearch-collection-endpoint',
    })

    new CfnOutput(this, 'OpenSearchDashboardEndpoint', {
      value: this.collection.attrDashboardEndpoint,
      description: 'OpenSearch Serverless dashboard endpoint',
      exportName: 'slaops-opensearch-dashboard-endpoint',
    })

    new CfnOutput(this, 'VpcEndpointId', {
      value: vpcEndpoint.attrId,
      description: 'OpenSearch Serverless VPC endpoint ID',
      exportName: 'slaops-opensearch-vpc-endpoint-id',
    })
  }
}
