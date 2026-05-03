import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, Tags, StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'

/**
 * Infrastructure stack for Derrops database resources
 *
 * This stack contains long-lived infrastructure that should persist across
 * feature deployments. It includes:
 * - Aurora Serverless v2 PostgreSQL cluster
 * - Database credentials in Secrets Manager
 * - Bastion host for database access
 *
 * VPC and networking resources are imported from the VPC stack.
 *
 * These resources are exported via CloudFormation outputs and can be
 * referenced by other stacks (like the Amplify backend).
 */
export class AppDatabaseStack extends Stack {
  public readonly vpc: ec2.IVpc
  public readonly cluster: rds.DatabaseCluster
  public readonly databaseCredentials: secretsmanager.Secret
  public readonly bastionHost: ec2.BastionHostLinux
  public readonly dbSecurityGroup: ec2.ISecurityGroup

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    Tags.of(this).add('derrops:domain', 'platform')
    Tags.of(this).add('derrops:service', 'app-database')

    const vpcId = Fn.importValue('derrops--platform--vpc--id')

    const publicSubnetIds = [
      Fn.importValue('derrops--platform--vpc--subnet-public-a'),
      Fn.importValue('derrops--platform--vpc--subnet-public-b'),
      Fn.importValue('derrops--platform--vpc--subnet-public-c'),
    ]

    const isolatedSubnetIds = [
      Fn.importValue('derrops--platform--vpc--subnet-isolated-a'),
      Fn.importValue('derrops--platform--vpc--subnet-isolated-b'),
      Fn.importValue('derrops--platform--vpc--subnet-isolated-c'),
    ]

    this.vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
      vpcId,
      availabilityZones: Fn.getAzs(),
    })

    const publicSubnets = publicSubnetIds.map((subnetId, index) =>
      ec2.Subnet.fromSubnetId(this, `PublicSubnet${index}`, subnetId),
    )

    const isolatedSubnets = isolatedSubnetIds.map((subnetId, index) =>
      ec2.Subnet.fromSubnetId(this, `IsolatedSubnet${index}`, subnetId),
    )

    const dbSecurityGroupId = Fn.importValue('derrops--platform--app-database--sg-id')
    this.dbSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ImportedDbSecurityGroup',
      dbSecurityGroupId,
    )

    this.databaseCredentials = new secretsmanager.Secret(this, 'DerropsDbCredentials', {
      secretName: 'derrops/platform/app-database/credentials',
      description: 'Database credentials for Derrops Aurora Serverless',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'derrops_admin',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
    })

    this.cluster = new rds.DatabaseCluster(this, 'DerropsAuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_17_6,
      }),
      credentials: rds.Credentials.fromSecret(this.databaseCredentials),
      defaultDatabaseName: 'derrops',
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
        subnets: isolatedSubnets,
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
    })

    const bastionSecurityGroup = new ec2.SecurityGroup(this, 'DerropsBastionSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for bastion host',
      allowAllOutbound: true,
    })

    this.bastionHost = new ec2.BastionHostLinux(this, 'DerropsBastionHost', {
      vpc: this.vpc,
      securityGroup: bastionSecurityGroup,
      subnetSelection: {
        subnets: publicSubnets,
      },
      instanceName: 'derrops--platform--app-database--bastion',
    })

    this.cluster.connections.allowFrom(
      this.bastionHost,
      ec2.Port.tcp(5432),
      'Allow bastion host to connect to database',
    )

    new CfnOutput(this, 'DatabaseClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'Aurora cluster writer endpoint',
      exportName: 'derrops--platform--app-database--cluster-endpoint',
    })

    new CfnOutput(this, 'DatabaseClusterReadEndpoint', {
      value: this.cluster.clusterReadEndpoint.hostname,
      description: 'Aurora cluster reader endpoint',
      exportName: 'derrops--platform--app-database--cluster-read-endpoint',
    })

    new CfnOutput(this, 'DatabaseName', {
      value: 'derrops',
      description: 'Database name',
      exportName: 'derrops--platform--app-database--name',
    })

    new CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseCredentials.secretArn,
      description: 'ARN of the secret containing database credentials',
      exportName: 'derrops--platform--app-database--secret-arn',
    })

    new CfnOutput(this, 'DatabasePort', {
      value: '5432',
      description: 'Database port',
      exportName: 'derrops--platform--app-database--port',
    })

    new CfnOutput(this, 'BastionHostId', {
      value: this.bastionHost.instanceId,
      description: 'Bastion host instance ID for SSH tunneling',
      exportName: 'derrops--platform--app-database--bastion-id',
    })
  }
}
