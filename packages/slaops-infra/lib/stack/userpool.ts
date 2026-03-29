import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
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
 * tenantId (e.g. "acme", "globex"). slaops-cloud manages group creation and
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
 * own account and grants the SlaOpsSqsPublishRole (exported below) SendMessage
 * permission via a queue resource policy. slaops-cloud then publishes cross-account.
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
      functionName: 'slaops-pre-token-generation',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '..', 'functions', 'pre-token-generation'),
      ),
      description:
        'V2 Pre-Token Generation trigger. Reads tenantId from the user\'s Cognito Group and injects it into the access token and id_token. No external calls — groups arrive in the trigger event.',
    })

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
    // V2 adds `claimsAndScopeOverrideDetails` which lets the Lambda inject
    // claims into the access token (V1 only supported id_token).
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool
    cfnUserPool.addPropertyOverride('LambdaConfig.PreTokenGenerationConfig', {
      LambdaArn: preTokenGenerationFn.functionArn,
      LambdaVersion: 'V2_0',
    })

    // Grant Cognito permission to invoke the function.
    // The L2 UserPool construct grants this automatically for lambdaTriggers.*
    // but not for the L1 override, so we add it manually.
    preTokenGenerationFn.addPermission('CognitoInvoke', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceArn: this.userPool.userPoolArn,
      action: 'lambda:InvokeFunction',
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
    // SQS Publish Role
    //
    // IAM role assumed by slaops-cloud Lambda when publishing jobs to relay
    // SQS queues. Used for both platform-owned queues (same account) and
    // relay-owned queues (cross-account, customer grants SendMessage via queue
    // resource policy using this role ARN).
    //
    // Customers running relay-owned queues must add a queue resource policy:
    //   Principal: { AWS: "<SlaOpsSqsPublishRoleArn>" }
    //   Action: sqs:SendMessage
    //   Resource: <their-queue-arn>
    // -------------------------------------------------------------------------
    this.sqsPublishRole = new iam.Role(this, 'SqsPublishRole', {
      roleName: 'SlaOpsSqsPublishRole',
      description: 'Used by slaops-cloud to publish relay jobs to SQS FIFO queues (platform-owned and cross-account relay-owned)',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    })

    // Platform-owned queues: publish to any slaops relay queue in this account
    this.sqsPublishRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'PublishToPlatformRelayQueues',
        effect: iam.Effect.ALLOW,
        actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes'],
        resources: [`arn:aws:sqs:*:${this.account}:slaops-*-local-*.fifo`],
      }),
    )

    // -------------------------------------------------------------------------
    // Cognito Identity Pool
    //
    // Allows CLI users to exchange their Cognito access_token / id_token for
    // short-lived AWS credentials (via STS AssumeRoleWithWebIdentity).
    // Used by the local relay process to consume from its dedicated SQS queue.
    //
    // Credentials expire in 1 hour and are refreshed automatically by the relay
    // process — no AWS credentials are ever written to disk.
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
    // The Identity Pool reads from the id_token for claim→tag mapping.
    // The V2 Lambda injects tenantId into both access token and id_token,
    // so the id_token always carries the tenantId claim for this mapping.
    //
    // Queue naming convention: slaops-{tenantId}-local-{userId}-{relayId}.fifo
    // IAM resource pattern:    slaops-{tenantId}-local-{userId}-*.fifo
    // -------------------------------------------------------------------------
    new cognito.CfnIdentityPoolPrincipalTag(this, 'IdentityPoolPrincipalTags', {
      identityPoolId: this.identityPool.ref,
      identityProviderName: this.userPool.userPoolProviderName,
      useDefaults: false,
      principalTags: {
        tenantId: 'tenantId', // Lambda-injected from Cognito Group name
        userId: 'sub',        // Cognito User Pool subject — stable UUID per user
      },
    })

    // IAM role assumed by authenticated Identity Pool identities.
    // Scoped by ABAC: each user can only consume from their own relay queues.
    const authenticatedRole = new iam.Role(this, 'IdentityPoolAuthenticatedRole', {
      roleName: 'SlaOpsIdentityPoolAuthRole',
      description: 'Assumed by authenticated SLAOps CLI users — ABAC-scoped SQS relay consume access',
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
        // ${aws:PrincipalTag/tenantId} and ${aws:PrincipalTag/userId} are
        // substituted at IAM evaluation time from the principal tags above.
        // A user with tenantId=acme, userId=abc-123 can only consume from:
        //   slaops-acme-local-abc-123-<any-relayId>.fifo
        // The \${} escaping prevents TypeScript template literal interpolation.
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
      description: 'Cognito Identity Pool ID — used by slaops-cli to exchange tokens for AWS credentials',
      exportName: 'SlaOpsIdentityPoolId',
    })

    new CfnOutput(this, 'IdentityPoolAuthRoleArn', {
      value: authenticatedRole.roleArn,
      description: 'IAM role ARN for authenticated Identity Pool users (relay SQS consume)',
      exportName: 'SlaOpsIdentityPoolAuthRoleArn',
    })

    new CfnOutput(this, 'SqsPublishRoleArn', {
      value: this.sqsPublishRole.roleArn,
      description:
        'IAM role ARN slaops-cloud uses to publish relay jobs to SQS. ' +
        'Enterprise customers using relay-owned queues must grant this role sqs:SendMessage on their queue.',
      exportName: 'SlaOpsSqsPublishRoleArn',
    })
  }
}
