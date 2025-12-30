import { Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export function createDatabaseResources(scope: Construct) {
  // Create VPC for the database
  const vpc = new ec2.Vpc(scope, 'SlaOpsVpc', {
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
  const dbSecurityGroup = new ec2.SecurityGroup(scope, 'SlaOpsDbSecurityGroup', {
    vpc,
    description: 'Security group for SLAOps Aurora Serverless database',
    allowAllOutbound: true,
  });

  // Allow inbound PostgreSQL traffic from within VPC
  dbSecurityGroup.addIngressRule(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.tcp(5432),
    'Allow PostgreSQL access from VPC',
  );

  // Create database credentials secret
  const databaseCredentials = new secretsmanager.Secret(scope, 'SlaOpsDbCredentials', {
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
  const cluster = new rds.DatabaseCluster(scope, 'SlaOpsAuroraCluster', {
    engine: rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_15_5,
    }),
    credentials: rds.Credentials.fromSecret(databaseCredentials),
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
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
    securityGroups: [dbSecurityGroup],
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
  const bastionSecurityGroup = new ec2.SecurityGroup(scope, 'SlaOpsBastionSecurityGroup', {
    vpc,
    description: 'Security group for bastion host',
    allowAllOutbound: true,
  });

  const bastionHost = new ec2.BastionHostLinux(scope, 'SlaOpsBastionHost', {
    vpc,
    securityGroup: bastionSecurityGroup,
    subnetSelection: {
      subnetType: ec2.SubnetType.PUBLIC,
    },
    instanceName: 'slaops-bastion',
  });

  // Allow bastion to connect to database
  cluster.connections.allowFrom(
    bastionHost,
    ec2.Port.tcp(5432),
    'Allow bastion host to connect to database',
  );

  // Output important values
  new CfnOutput(scope, 'DatabaseClusterEndpoint', {
    value: cluster.clusterEndpoint.hostname,
    description: 'Aurora cluster writer endpoint',
    exportName: 'SlaOpsDbClusterEndpoint',
  });

  new CfnOutput(scope, 'DatabaseClusterReadEndpoint', {
    value: cluster.clusterReadEndpoint.hostname,
    description: 'Aurora cluster reader endpoint',
    exportName: 'SlaOpsDbClusterReadEndpoint',
  });

  new CfnOutput(scope, 'DatabaseName', {
    value: 'slaops',
    description: 'Database name',
    exportName: 'SlaOpsDbName',
  });

  new CfnOutput(scope, 'DatabaseSecretArn', {
    value: databaseCredentials.secretArn,
    description: 'ARN of the secret containing database credentials',
    exportName: 'SlaOpsDbSecretArn',
  });

  new CfnOutput(scope, 'DatabasePort', {
    value: '5432',
    description: 'Database port',
    exportName: 'SlaOpsDbPort',
  });

  new CfnOutput(scope, 'BastionHostId', {
    value: bastionHost.instanceId,
    description: 'Bastion host instance ID for SSH tunneling',
    exportName: 'SlaOpsBastionHostId',
  });

  new CfnOutput(scope, 'VpcId', {
    value: vpc.vpcId,
    description: 'VPC ID',
    exportName: 'SlaOpsVpcId',
  });

  return {
    vpc,
    cluster,
    databaseCredentials,
    bastionHost,
    dbSecurityGroup,
  };
}
