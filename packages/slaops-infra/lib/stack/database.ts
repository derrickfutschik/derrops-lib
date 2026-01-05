import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * Infrastructure stack for SLAOps database resources
 *
 * This stack contains long-lived infrastructure that should persist across
 * feature deployments. It includes:
 * - VPC with public, private, and isolated subnets
 * - Aurora Serverless v2 PostgreSQL cluster
 * - Database credentials in Secrets Manager
 * - Bastion host for database access
 *
 * These resources are exported via CloudFormation outputs and can be
 * referenced by other stacks (like the Amplify backend).
 */
export class DatabaseStack extends Stack {
  public readonly vpc: ec2.Vpc;
  public readonly cluster: rds.DatabaseCluster;
  public readonly databaseCredentials: secretsmanager.Secret;
  public readonly bastionHost: ec2.BastionHostLinux;
  public readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create VPC for the database
    this.vpc = new ec2.Vpc(this, 'SlaOpsVpc', {
      maxAzs: 2,
      natGateways: 1,
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
          cidrMask: 28,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Security group for the database
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'SlaOpsDbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for SLAOps Aurora Serverless database',
      allowAllOutbound: true,
    });

    // Allow inbound PostgreSQL traffic from within VPC
    this.dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from VPC',
    );

    // Create database credentials secret
    this.databaseCredentials = new secretsmanager.Secret(this, 'SlaOpsDbCredentials', {
      secretName: 'slaops/database/credentials',
      description: 'Database credentials for SLAOps Aurora Serverless',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'slaops_admin',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Create Aurora Serverless v2 PostgreSQL cluster
    this.cluster = new rds.DatabaseCluster(this, 'SlaOpsAuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_5,
      }),
      credentials: rds.Credentials.fromSecret(this.databaseCredentials),
      defaultDatabaseName: 'slaops',
      writer: rds.ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: false,
      }),
      readers: [
        rds.ClusterInstance.serverlessV2('reader', {
          scaleWithWriter: true,
          publiclyAccessible: false,
        }),
      ],
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.dbSecurityGroup],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      backup: {
        retention: Duration.days(7),
        preferredWindow: '03:00-04:00',
      },
      removalPolicy: RemovalPolicy.SNAPSHOT,
      storageEncrypted: true,
    });

    // Create a bastion host for database access (optional, for development)
    const bastionSecurityGroup = new ec2.SecurityGroup(this, 'SlaOpsBastionSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for bastion host',
      allowAllOutbound: true,
    });

    this.bastionHost = new ec2.BastionHostLinux(this, 'SlaOpsBastionHost', {
      vpc: this.vpc,
      securityGroup: bastionSecurityGroup,
      subnetSelection: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceName: 'slaops-bastion',
    });

    // Allow bastion to connect to database
    this.cluster.connections.allowFrom(
      this.bastionHost,
      ec2.Port.tcp(5432),
      'Allow bastion host to connect to database',
    );

    // Export important values via CloudFormation outputs
    // These can be referenced by other stacks using Fn.importValue()
    new CfnOutput(this, 'DatabaseClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'Aurora cluster writer endpoint',
      exportName: 'SlaOpsDbClusterEndpoint',
    });

    new CfnOutput(this, 'DatabaseClusterReadEndpoint', {
      value: this.cluster.clusterReadEndpoint.hostname,
      description: 'Aurora cluster reader endpoint',
      exportName: 'SlaOpsDbClusterReadEndpoint',
    });

    new CfnOutput(this, 'DatabaseName', {
      value: 'slaops',
      description: 'Database name',
      exportName: 'SlaOpsDbName',
    });

    new CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseCredentials.secretArn,
      description: 'ARN of the secret containing database credentials',
      exportName: 'SlaOpsDbSecretArn',
    });

    new CfnOutput(this, 'DatabasePort', {
      value: '5432',
      description: 'Database port',
      exportName: 'SlaOpsDbPort',
    });

    new CfnOutput(this, 'BastionHostId', {
      value: this.bastionHost.instanceId,
      description: 'Bastion host instance ID for SSH tunneling',
      exportName: 'SlaOpsBastionHostId',
    });

    new CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'SlaOpsVpcId',
    });
  }
}
