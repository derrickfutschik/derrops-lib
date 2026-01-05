import { Stack, StackProps, CfnOutput, Fn } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * Infrastructure stack for SLAOps centralized security groups
 *
 * This stack contains security groups for:
 * - OpenSearch domain
 * - RDS database (PostgreSQL)
 * - Lambda backend function
 *
 * The Lambda security group is configured to allow outbound access to both
 * OpenSearch and RDS. The OpenSearch and RDS security groups allow inbound
 * traffic from the Lambda security group.
 *
 * VPC resources are imported from the VPC stack via CloudFormation exports.
 *
 * These security groups are exported via CloudFormation outputs and can be
 * referenced by other stacks.
 */
export class SecurityGroupStack extends Stack {
    public readonly opensearchSecurityGroup: ec2.SecurityGroup;
    public readonly rdsSecurityGroup: ec2.SecurityGroup;
    public readonly backendSecurityGroup: ec2.SecurityGroup;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Import VPC from the VPC stack using CloudFormation exports
        const vpcId = Fn.importValue('slaops-vpc-id');
        const vpcCidrBlock = Fn.importValue('slaops-vpc-cidr-block');
        const availabilityZones = [
            Fn.importValue('slaops-availability-zone-1'),
            Fn.importValue('slaops-availability-zone-2'),
            Fn.importValue('slaops-availability-zone-3'),
        ];

        // Import subnet IDs from VPC stack
        const publicSubnetIds = [
            Fn.importValue('slaops-vpc-subnet-public-a'),
            Fn.importValue('slaops-vpc-subnet-public-b'),
            Fn.importValue('slaops-vpc-subnet-public-c'),
        ];

        const privateSubnetIds = [
            Fn.importValue('slaops-vpc-subnet-private-a'),
            Fn.importValue('slaops-vpc-subnet-private-b'),
            Fn.importValue('slaops-vpc-subnet-private-c'),
        ];

        const isolatedSubnetIds = [
            Fn.importValue('slaops-vpc-subnet-isolated-a'),
            Fn.importValue('slaops-vpc-subnet-isolated-b'),
            Fn.importValue('slaops-vpc-subnet-isolated-c'),
        ];

        // Reconstruct VPC from imported attributes
        const vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
            vpcId,
            vpcCidrBlock,
            availabilityZones,
            publicSubnetIds,
            privateSubnetIds,
            isolatedSubnetIds,
        });

        // Security group for OpenSearch domain
        this.opensearchSecurityGroup = new ec2.SecurityGroup(
            this,
            'SlaOpsOpenSearchSecurityGroup',
            {
                vpc,
                description: 'Security group for SLAOps OpenSearch domain',
                allowAllOutbound: true,
                securityGroupName: 'slaops-opensearch-sg',
            },
        );

        // Security group for RDS database
        this.rdsSecurityGroup = new ec2.SecurityGroup(
            this,
            'SlaOpsRdsSecurityGroup',
            {
                vpc,
                description: 'Security group for SLAOps RDS PostgreSQL database',
                allowAllOutbound: true,
                securityGroupName: 'slaops-rds-sg',
            },
        );

        // Security group for Lambda backend
        this.backendSecurityGroup = new ec2.SecurityGroup(
            this,
            'SlaOpsBackendSecurityGroup',
            {
                vpc,
                description: 'Security group for SLAOps backend Lambda function',
                allowAllOutbound: true,
                securityGroupName: 'slaops-backend-sg',
            },
        );

        // Allow Lambda backend to access OpenSearch (HTTPS port 443)
        this.opensearchSecurityGroup.addIngressRule(
            this.backendSecurityGroup,
            ec2.Port.tcp(443),
            'Allow HTTPS access from Lambda backend',
        );

        // Allow Lambda backend to access RDS (PostgreSQL port 5432)
        this.rdsSecurityGroup.addIngressRule(
            this.backendSecurityGroup,
            ec2.Port.tcp(5432),
            'Allow PostgreSQL access from Lambda backend',
        );

        // Export security group IDs via CloudFormation outputs
        new CfnOutput(this, 'OpenSearchSecurityGroupId', {
            value: this.opensearchSecurityGroup.securityGroupId,
            description: 'Security group ID for OpenSearch domain',
            exportName: 'slaops-opensearch-sg',
        });

        new CfnOutput(this, 'RdsSecurityGroupId', {
            value: this.rdsSecurityGroup.securityGroupId,
            description: 'Security group ID for RDS database',
            exportName: 'slaops-rds-sg',
        });

        new CfnOutput(this, 'BackendSecurityGroupId', {
            value: this.backendSecurityGroup.securityGroupId,
            description: 'Security group ID for Lambda backend',
            exportName: 'slaops-backend-sg',
        });
    }
}

