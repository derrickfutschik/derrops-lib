import { CfnOutput, Fn, Stack, Tags, StackProps } from 'aws-cdk-lib'
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

    Tags.of(this).add('slaops:domain', 'platform')
    Tags.of(this).add('slaops:service', 'opensearch')

    const vpcId = Fn.importValue('slaops--platform--vpc--id')

    const privateSubnetIds = [
      Fn.importValue('slaops--platform--vpc--subnet-private-a'),
      Fn.importValue('slaops--platform--vpc--subnet-private-b'),
      Fn.importValue('slaops--platform--vpc--subnet-private-c'),
    ]

    this.vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
      vpcId,
      availabilityZones: Fn.getAzs(),
    })

    const privateSubnets = privateSubnetIds.map((subnetId, index) =>
      ec2.Subnet.fromSubnetId(this, `PrivateSubnet${index}`, subnetId),
    )

    const opensearchSecurityGroupId = Fn.importValue('slaops--platform--opensearch--sg-id')
    this.opensearchSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ImportedOpenSearchSecurityGroup',
      opensearchSecurityGroupId,
    )

    // OpenSearch Serverless resource names have a 32-char limit; use shortened forms
    const vpcEndpoint = new opensearchserverless.CfnVpcEndpoint(this, 'SlaOpsVpcEndpoint', {
      name: 'slaops--opensearch--vpc-ep',
      vpcId,
      subnetIds: privateSubnetIds,
      securityGroupIds: [opensearchSecurityGroupId],
    })

    // Use a local constant so network policy and collection stay in sync
    const collectionName = 'slaops--opensearch'

    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'SlaOpsNetworkPolicy', {
      name: 'slaops--opensearch--net-policy',
      type: 'network',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${collectionName}`],
            AllowFromPublic: false,
            SourceVPCEs: [vpcEndpoint.attrId],
          },
        ],
      }),
    })

    networkPolicy.addDependency(vpcEndpoint)

    this.collection = new opensearchserverless.CfnCollection(this, 'SlaOpsOpenSearchCollection', {
      name: collectionName,
      type: 'SEARCH',
      description: 'SLAOps OpenSearch Serverless collection for log analytics and OASpec search',
    })

    this.collection.addDependency(networkPolicy)

    const dataAccessPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      'SlaOpsDataAccessPolicy',
      {
        name: 'slaops--opensearch--data-access',
        type: 'data',
        policy: JSON.stringify({
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${collectionName}`],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DeleteCollectionItems',
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems',
              ],
              Principal: [`arn:aws:iam::${this.account}:root`],
            },
            {
              ResourceType: 'index',
              Resource: [`index/${collectionName}/*`],
              Permission: [
                'aoss:CreateIndex',
                'aoss:DeleteIndex',
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument',
              ],
              Principal: [`arn:aws:iam::${this.account}:root`],
            },
          ],
        }),
      },
    )

    dataAccessPolicy.addDependency(this.collection)

    // CfnCollection does not inherit stack-level tags — apply directly
    this.collection.tags.setTag('slaops:org', 'slaops')
    this.collection.tags.setTag('slaops:domain', 'platform')
    this.collection.tags.setTag('slaops:service', 'opensearch')
    this.collection.tags.setTag('slaops:managed-by', 'cdk')

    new CfnOutput(this, 'OpenSearchCollectionId', {
      value: this.collection.attrId,
      description: 'OpenSearch Serverless collection ID',
      exportName: 'slaops--platform--opensearch--collection-id',
    })

    new CfnOutput(this, 'OpenSearchCollectionName', {
      value: this.collection.name,
      description: 'OpenSearch Serverless collection name',
      exportName: 'slaops--platform--opensearch--collection-name',
    })

    new CfnOutput(this, 'OpenSearchCollectionArn', {
      value: this.collection.attrArn,
      description: 'OpenSearch Serverless collection ARN',
      exportName: 'slaops--platform--opensearch--collection-arn',
    })

    new CfnOutput(this, 'OpenSearchCollectionEndpoint', {
      value: this.collection.attrCollectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
      exportName: 'slaops--platform--opensearch--collection-endpoint',
    })

    new CfnOutput(this, 'OpenSearchDashboardEndpoint', {
      value: this.collection.attrDashboardEndpoint,
      description: 'OpenSearch Serverless dashboard endpoint',
      exportName: 'slaops--platform--opensearch--dashboard-endpoint',
    })

    new CfnOutput(this, 'VpcEndpointId', {
      value: vpcEndpoint.attrId,
      description: 'OpenSearch Serverless VPC endpoint ID',
      exportName: 'slaops--platform--opensearch--vpc-endpoint-id',
    })
  }
}
