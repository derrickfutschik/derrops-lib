import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, StackProps } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as path from 'path'
import { Construct } from 'constructs'

/**
 * Infrastructure stack for SLAOps authentication resources.
 *
 * ## Tenant membership
 *
 * Tenants are represented as Cognito User Pool Groups. Each group's name IS the
 * tenantId (e.g. "t-a3f8b2"). slaops-cloud manages group creation and
 * user→group assignment via the Cognito Admin API, with the canonical records
 * stored in RDS. No DynamoDB is used.
 *
 * The Pre-Token Generation V2 Lambda reads the user's groups directly from the
 * trigger event (no external calls) and injects `tenantId` into both the
 * access token and id_token.
 *
 * ## SQS relay queues (platform-owned)
 *
 * When a relay connection is registered with delivery mode `platform`, slaops-cloud
 * provisions a dedicated SQS FIFO queue in the SLAOps account and stores its URL
 * in RDS. The relay authenticates via Identity Pool → STS and polls the queue.
 *
 * For enterprise customers who cannot reach SQS endpoints in the SLAOps account,
 * a `relay` queue mode is available — the customer provisions the queue in their
 * own account and grants the slaops--platform--auth--sqs-publish-role (exported below)
 * SendMessage permission via a queue resource policy. slaops-cloud then publishes cross-account.
 *
 * See userpool.md for the full architecture diagram and flow.
 */
export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly identityPool: cognito.CfnIdentityPool
  /** IAM role slaops-cloud uses to publish to SQS relay queues (both platform-owned and cross-account relay-owned). */
  public readonly sqsPublishRole: iam.Role

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    Tags.of(this).add('slaops:domain', 'auth')
    Tags.of(this).add('slaops:service', 'cognito')

    // -------------------------------------------------------------------------
    // Pre-Token Generation Lambda (V2)
    //
    // Reads the user's Cognito Groups from the trigger event — no external calls.
    // Injects tenantId (= group name) into both access token and id_token.
    //
    // V2 trigger is set via the CfnUserPool L1 escape hatch because CDK's L2
    // UserPool currently only exposes the V1 preTokenGeneration trigger key.
    // -------------------------------------------------------------------------
    const preTokenGenerationFn = new lambda.Function(this, 'PreTokenGenerationFn', {
      functionName: 'slaops--auth--cognito--pre-token-generation',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'functions', 'pre-token-generation')),
      description:
        "V2 Pre-Token Generation trigger. Reads tenantId from the user's Cognito Group and injects it into the access token and id_token. No external calls — groups arrive in the trigger event.",
    })

    // -------------------------------------------------------------------------
    // Cognito User Pool
    // -------------------------------------------------------------------------
    this.userPool = new cognito.UserPool(this, 'SlaOpsUserPool', {
      userPoolName: 'slaops--auth--cognito--users',
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
      // No custom attributes — tenantId comes from the user's Group, injected
      // server-side by the Pre-Token Generation Lambda. Users cannot change it.
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
      deletionProtection: true,
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      // lambdaTriggers.preTokenGeneration is V1 only.
      // V2 is wired below via the CfnUserPool L1 escape hatch.
    })

    // Wire the V2 Pre-Token Generation trigger via L1 escape hatch.
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool
    cfnUserPool.addPropertyOverride('LambdaConfig.PreTokenGenerationConfig', {
      LambdaArn: preTokenGenerationFn.functionArn,
      LambdaVersion: 'V2_0',
    })

    preTokenGenerationFn.addPermission('CognitoInvoke', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceArn: this.userPool.userPoolArn,
      action: 'lambda:InvokeFunction',
    })

    // -------------------------------------------------------------------------
    // User Pool Client — public PKCE client for the slaops-cli
    // -------------------------------------------------------------------------
    this.userPoolClient = new cognito.UserPoolClient(this, 'SlaOpsUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'slaops-cli',
      generateSecret: false,
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
        callbackUrls: ['http://localhost:9876/callback'],
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: Duration.days(30),
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
    })

    // -------------------------------------------------------------------------
    // SQS Publish Role
    // -------------------------------------------------------------------------
    this.sqsPublishRole = new iam.Role(this, 'SqsPublishRole', {
      roleName: 'slaops--platform--auth--sqs-publish-role',
      description:
        'Used by slaops-cloud to publish relay jobs to SQS FIFO queues (platform-owned and cross-account relay-owned)',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    })

    // Platform-owned queues: full lifecycle management + publish for queues in this account.
    // CreateQueue and DeleteQueue are called by relay-queue.service.ts at relay
    // registration and teardown respectively.
    this.sqsPublishRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ManageAndPublishToPlatformRelayQueues',
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:CreateQueue',
          'sqs:DeleteQueue',
          'sqs:SendMessage',
          'sqs:GetQueueAttributes',
        ],
        resources: [`arn:aws:sqs:*:${this.account}:slaops-*-local-*.fifo`],
      }),
    )

    // Relay-owned queues (cross-account): slaops-cloud publishes to a customer-provisioned
    // FIFO queue in their AWS account. The customer's queue resource policy authorises this
    // role via sqs:SendMessage; this IAM statement is the sender-side permission required for
    // cross-account delivery. No CreateQueue/DeleteQueue — slaops-cloud never manages
    // customer-owned queues.
    this.sqsPublishRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'PublishToRelayOwnedQueues',
        effect: iam.Effect.ALLOW,
        actions: ['sqs:SendMessage'],
        resources: ['arn:aws:sqs:*:*:*.fifo'],
        conditions: {
          StringNotEquals: {
            'aws:ResourceAccount': this.account,
          },
        },
      }),
    )

    // -------------------------------------------------------------------------
    // Cognito Identity Pool
    // -------------------------------------------------------------------------
    this.identityPool = new cognito.CfnIdentityPool(this, 'SlaOpsIdentityPool', {
      identityPoolName: 'slaops--auth--cognito--relay-identity-pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: true,
        },
      ],
    })

    // -------------------------------------------------------------------------
    // Principal tag mapping — ABAC for SQS queue isolation
    // -------------------------------------------------------------------------
    new cognito.CfnIdentityPoolPrincipalTag(this, 'IdentityPoolPrincipalTags', {
      identityPoolId: this.identityPool.ref,
      identityProviderName: this.userPool.userPoolProviderName,
      useDefaults: false,
      principalTags: {
        tenantId: 'tenantId', // Lambda-injected from Cognito Group name
        userId: 'sub', // Cognito User Pool subject — stable UUID per user
      },
    })

    const authenticatedRole = new iam.Role(this, 'IdentityPoolAuthenticatedRole', {
      roleName: 'slaops--platform--auth--identity-pool-auth-role',
      description:
        'Assumed by authenticated SLAOps CLI users — ABAC-scoped SQS relay consume access',
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
        actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        // ${aws:PrincipalTag/tenantId} and ${aws:PrincipalTag/userId} are
        // substituted at IAM evaluation time from the principal tags above.
        resources: [
          `arn:aws:sqs:*:${this.account}:slaops-\${aws:PrincipalTag/tenantId}-local-\${aws:PrincipalTag/userId}-*.fifo`,
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
      exportName: 'slaops--auth--cognito--user-pool-id',
    })

    new CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: 'slaops--auth--cognito--user-pool-arn',
    })

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID (public PKCE client for slaops-cli)',
      exportName: 'slaops--auth--cognito--user-pool-client-id',
    })

    new CfnOutput(this, 'UserPoolProviderName', {
      value: this.userPool.userPoolProviderName,
      description: 'Cognito User Pool Provider Name',
      exportName: 'slaops--auth--cognito--user-pool-provider-name',
    })

    new CfnOutput(this, 'UserPoolProviderUrl', {
      value: this.userPool.userPoolProviderUrl,
      description: 'Cognito User Pool Provider URL',
      exportName: 'slaops--auth--cognito--user-pool-provider-url',
    })

    new CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description:
        'Cognito Identity Pool ID — used by slaops-cli to exchange tokens for AWS credentials',
      exportName: 'slaops--auth--cognito--identity-pool-id',
    })

    new CfnOutput(this, 'IdentityPoolAuthRoleArn', {
      value: authenticatedRole.roleArn,
      description: 'IAM role ARN for authenticated Identity Pool users (relay SQS consume)',
      exportName: 'slaops--auth--cognito--identity-pool-auth-role-arn',
    })

    new CfnOutput(this, 'SqsPublishRoleArn', {
      value: this.sqsPublishRole.roleArn,
      description:
        'IAM role ARN slaops-cloud uses to publish relay jobs to SQS. ' +
        'Enterprise customers using relay-owned queues must grant this role sqs:SendMessage on their queue.',
      exportName: 'slaops--auth--cognito--sqs-publish-role-arn',
    })
  }
}
