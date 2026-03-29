import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as path from 'path'
import { Construct } from 'constructs'

/**
 * Infrastructure stack for SLAOps authentication resources.
 *
 * Contains the Cognito User Pool, a public app client (PKCE), and a Cognito
 * Identity Pool that lets authenticated CLI users exchange their Cognito
 * id_token for short-lived AWS credentials scoped to their relay's SQS queue.
 *
 * tenantId is NOT stored as a Cognito custom attribute. Instead, a Pre-Token
 * Generation Lambda reads it from a platform-managed DynamoDB table and injects
 * it into the token as a trusted claim. Users have no way to change this value.
 *
 * See userpool.md for architecture details and the infrastructure diagram.
 */
export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly identityPool: cognito.CfnIdentityPool
  public readonly tenantMembershipTable: dynamodb.Table

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // -------------------------------------------------------------------------
    // DynamoDB — Tenant Membership Table
    //
    // Authoritative source of user→tenant assignments. Written exclusively by
    // slaops-cloud (the platform backend) when a user is provisioned into or
    // removed from a tenant. Read only by the Pre-Token Generation Lambda.
    //
    // This table is the security boundary for tenantId. Users have no IAM
    // permissions to read or write it directly.
    // -------------------------------------------------------------------------
    this.tenantMembershipTable = new dynamodb.Table(this, 'TenantMembershipTable', {
      tableName: 'slaops-tenant-memberships',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    })

    // -------------------------------------------------------------------------
    // Pre-Token Generation Lambda
    //
    // Runs on every token generation event. Reads the user's tenantId from the
    // platform-managed DynamoDB table and injects it into the id_token via
    // claimsOverrideDetails. This is the only way tenantId enters the token —
    // users cannot set or change it.
    //
    // Fails open: if the DynamoDB lookup fails or returns no item, the token is
    // issued without a tenantId claim. The IAM variable substitution in the SQS
    // resource ARN will then produce no matching queue, so access is denied.
    // -------------------------------------------------------------------------
    const preTokenGenerationFn = new lambda.Function(this, 'PreTokenGenerationFn', {
      functionName: 'slaops-pre-token-generation',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '..', 'functions', 'pre-token-generation'),
      ),
      environment: {
        TENANT_MEMBERSHIP_TABLE: this.tenantMembershipTable.tableName,
      },
      description:
        'Injects tenantId into Cognito id_token from platform-managed DynamoDB table. Cannot be overridden by users.',
    })

    // Grant the Lambda read-only access to the tenant membership table
    this.tenantMembershipTable.grantReadData(preTokenGenerationFn)

    // -------------------------------------------------------------------------
    // Cognito User Pool
    // -------------------------------------------------------------------------
    this.userPool = new cognito.UserPool(this, 'SlaOpsUserPool', {
      userPoolName: 'slaops-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(7),
      },
      // No custom:tenantId attribute. tenantId is injected server-side by the
      // Pre-Token Generation Lambda from the platform-managed DynamoDB table.
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
      deletionProtection: true,
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      lambdaTriggers: {
        // V1 trigger — injects tenantId into the id_token from DynamoDB.
        // The Lambda is granted Cognito resource-based invocation permission
        // automatically by the CDK UserPool construct.
        preTokenGeneration: preTokenGenerationFn,
      },
    })

    // -------------------------------------------------------------------------
    // User Pool Client — public PKCE client for the slaops-cli
    // No client secret: the CLI is a public client and uses PKCE for security.
    // Refresh tokens live for 30 days; developers re-authenticate monthly.
    // -------------------------------------------------------------------------
    this.userPoolClient = new cognito.UserPoolClient(this, 'SlaOpsUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'slaops-cli',
      generateSecret: false, // public client — PKCE only
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: ['http://localhost:9876/callback'], // loopback redirect for CLI PKCE flow
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: Duration.days(30),
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
    })

    // -------------------------------------------------------------------------
    // Cognito Identity Pool
    //
    // Allows CLI users to exchange their Cognito id_token for temporary AWS
    // credentials (via STS AssumeRoleWithWebIdentity). These credentials are
    // used by the local relay to consume from its dedicated SQS queue.
    //
    // Credentials are short-lived (1 hour) and auto-refreshed by the relay
    // process using the stored Cognito refresh token — no AWS credentials are
    // ever written to disk.
    // -------------------------------------------------------------------------
    this.identityPool = new cognito.CfnIdentityPool(this, 'SlaOpsIdentityPool', {
      identityPoolName: 'slaops_relay_identity_pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: true, // validate tokens against Cognito on every exchange
        },
      ],
    })

    // -------------------------------------------------------------------------
    // Principal tag mapping — ABAC for SQS queue isolation
    //
    // Maps claims from the Cognito id_token to IAM principal tags so that the
    // IAM policy can use ${aws:PrincipalTag/tenantId} and
    // ${aws:PrincipalTag/userId} as variables in the SQS resource ARN.
    //
    // tenantId is the Lambda-injected claim (no "custom:" prefix — it is not a
    // Cognito custom attribute, it is a plain claim added by claimsOverrideDetails).
    // userId is the Cognito User Pool "sub" — a stable UUID per user.
    //
    // Queue naming convention: slaops-{tenantId}-local-{userId}-{relayId}
    // IAM resource pattern:    slaops-{tenantId}-local-{userId}-*
    // -------------------------------------------------------------------------
    new cognito.CfnIdentityPoolPrincipalTag(this, 'IdentityPoolPrincipalTags', {
      identityPoolId: this.identityPool.ref,
      identityProviderName: this.userPool.userPoolProviderName,
      useDefaults: false, // only use explicitly mapped tags below
      principalTags: {
        tenantId: 'tenantId', // Lambda-injected claim — not a Cognito custom attribute
        userId: 'sub',        // Cognito User Pool subject — stable unique user ID
      },
    })

    // IAM role assumed by authenticated Identity Pool identities.
    // Access is scoped to the caller's own queues via ABAC principal tag variables.
    const authenticatedRole = new iam.Role(this, 'IdentityPoolAuthenticatedRole', {
      roleName: 'SlaOpsIdentityPoolAuthRole',
      description: 'Assumed by authenticated SLAOps CLI users — ABAC-scoped SQS relay access',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    })

    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'RelayQueueConsume',
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
        ],
        // IAM policy variables ${aws:PrincipalTag/tenantId} and
        // ${aws:PrincipalTag/userId} are substituted at evaluation time from
        // the principal tags mapped above. A user with tenantId=acme and
        // userId=abc123 can only access: slaops-acme-local-abc123-*
        // The \${} escaping prevents TypeScript from interpolating these as
        // template literals — they are intentional IAM policy variable syntax.
        resources: [
          `arn:aws:sqs:*:${this.account}:slaops-\${aws:PrincipalTag/tenantId}-local-\${aws:PrincipalTag/userId}-*`,
        ],
      }),
    )

    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    })

    // -------------------------------------------------------------------------
    // CloudFormation outputs
    // -------------------------------------------------------------------------
    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'SlaOpsUserPoolId',
    })

    new CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: 'SlaOpsUserPoolArn',
    })

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID (public PKCE client for slaops-cli)',
      exportName: 'SlaOpsUserPoolClientId',
    })

    new CfnOutput(this, 'UserPoolProviderName', {
      value: this.userPool.userPoolProviderName,
      description: 'Cognito User Pool Provider Name',
      exportName: 'SlaOpsUserPoolProviderName',
    })

    new CfnOutput(this, 'UserPoolProviderUrl', {
      value: this.userPool.userPoolProviderUrl,
      description: 'Cognito User Pool Provider URL',
      exportName: 'SlaOpsUserPoolProviderUrl',
    })

    new CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID — used by slaops-cli to exchange id_token for AWS credentials',
      exportName: 'SlaOpsIdentityPoolId',
    })

    new CfnOutput(this, 'IdentityPoolAuthRoleArn', {
      value: authenticatedRole.roleArn,
      description: 'IAM role ARN for authenticated Identity Pool users',
      exportName: 'SlaOpsIdentityPoolAuthRoleArn',
    })

    new CfnOutput(this, 'TenantMembershipTableName', {
      value: this.tenantMembershipTable.tableName,
      description:
        'DynamoDB table name for user→tenant assignments — slaops-cloud writes here when provisioning users',
      exportName: 'SlaOpsTenantMembershipTableName',
    })

    new CfnOutput(this, 'TenantMembershipTableArn', {
      value: this.tenantMembershipTable.tableArn,
      description: 'DynamoDB table ARN for slaops-cloud IAM policy attachment',
      exportName: 'SlaOpsTenantMembershipTableArn',
    })
  }
}
