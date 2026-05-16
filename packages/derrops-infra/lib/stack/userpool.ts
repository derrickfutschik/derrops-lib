import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, StackProps } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as path from 'path'
import { Construct } from 'constructs'
import { resources } from '../names'
import { config } from '@derrops/config'
import { DerropsStack } from './derrops-stack'
import { DerropsConventions } from '@derrops-conventions'

/**
 * Infrastructure stack for Derrops authentication resources.
 *
 * ## Tenant membership
 *
 * Tenants are represented as Cognito User Pool Groups. Each group's name IS the
 * tenantId (e.g. "t-a3f8b2"). derrops-cloud manages group creation and
 * user→group assignment via the Cognito Admin API, with the canonical records
 * stored in RDS. No DynamoDB is used.
 *
 * The Pre-Token Generation V2 Lambda reads the user's groups directly from the
 * trigger event (no external calls) and injects `tenantId` into both the
 * access token and id_token.
 *
 * ## SQS relay queues (platform-owned)
 *
 * When a relay connection is registered with delivery mode `platform`, derrops-cloud
 * provisions a dedicated SQS FIFO queue in the Derrops account and stores its URL
 * in RDS. The relay authenticates via Identity Pool → STS and polls the queue.
 *
 * For enterprise customers who cannot reach SQS endpoints in the Derrops account,
 * a `relay` queue mode is available — the customer provisions the queue in their
 * own account and grants the derrops--platform--auth--sqs-publish-role (exported below)
 * SendMessage permission via a queue resource policy. derrops-cloud then publishes cross-account.
 *
 * See userpool.md for the full architecture diagram and flow.
 */
export class UserPoolStack extends DerropsStack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly identityPool: cognito.CfnIdentityPool
  /** IAM role derrops-cloud uses to publish to SQS relay queues (both platform-owned and cross-account relay-owned). */
  public readonly sqsPublishRole: iam.Role

  // TODO - parse in the convention for naming
  // TODO - consider extending Stack for a Derrops Stack
  constructor(conventions: DerropsConventions, scope: Construct, id: string, props?: StackProps) {
    super(conventions, scope, id, props)



    // const preTokenGenerationFn = new lambda.Function(this, 'PreTokenGenerationFn', {
    //     functionName: 'derrops--auth--cognito--pre-token-generation',
    //     runtime: lambda.Runtime.NODEJS_22_X,
    //     handler: 'index.handler',
    //     code: lambda.Code.fromAsset(path.join(__dirname, '..', 'functions', 'pre-token-generation')),
    //     description:
    //       "V2 Pre-Token Generation trigger. Reads tenantId from the user's Cognito Group and injects it into the access token and id_token. No external calls — groups arrive in the trigger event.",
    //   })



    // -------------------------------------------------------------------------
    // Cognito User Pool
    // -------------------------------------------------------------------------
    this.userPool = new cognito.UserPool(this, 'DerropsUserPool', {
      userPoolName: this.name({ type: "cognitoUserPool" }),
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


    // -------------------------------------------------------------------------
    // User Pool Client — public PKCE client for the derrops-cli
    // -------------------------------------------------------------------------
    this.userPoolClient = new cognito.UserPoolClient(this, 'DerropsUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'derrops-cli',
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
      roleName: this.name({ type: 'iamRole', purpose: 'sqs-publish' }),
      description:
        'Used by derrops-cloud to publish relay jobs to SQS FIFO queues (platform-owned and cross-account relay-owned)',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    })

    // Platform-owned queues: full lifecycle management + publish for queues in this account.
    // CreateQueue and DeleteQueue are called by relay-queue.service.ts at relay
    // registration and teardown respectively.
    const sqsPublishPolicy = new iam.Policy(this, 'SqsPublishPolicy', {
      policyName: this.name({ type: 'iamPolicy', purpose: 'sqs-publish' }),
      statements: [
        new iam.PolicyStatement({
          sid: 'ManageAndPublishToPlatformRelayQueues',
          effect: iam.Effect.ALLOW,
          actions: [
            'sqs:CreateQueue',
            'sqs:DeleteQueue',
            'sqs:SendMessage',
            'sqs:GetQueueAttributes',
          ],
          resources: [`arn:aws:sqs:*:${this.account}:derrops-*-local-*.fifo`],
        }),
        // Relay-owned queues (cross-account): derrops-cloud publishes to a customer-provisioned
        // FIFO queue in their AWS account. The customer's queue resource policy authorises this
        // role via sqs:SendMessage; this IAM statement is the sender-side permission required for
        // cross-account delivery. No CreateQueue/DeleteQueue — derrops-cloud never manages
        // customer-owned queues.
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
      ],
    })
    this.sqsPublishRole.attachInlinePolicy(sqsPublishPolicy)

    // -------------------------------------------------------------------------
    // Cognito Identity Pool
    // -------------------------------------------------------------------------
    this.identityPool = new cognito.CfnIdentityPool(this, 'DerropsIdentityPool', {
      identityPoolName: this.name({ type: 'cognitoIdentityPool' }),
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
      roleName: this.name({ type: 'iamRole', purpose: 'authenticated' }),
      description:
        'Assumed by authenticated Derrops CLI users — ABAC-scoped SQS relay consume access',
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

    const relayConsumePolicy = new iam.Policy(this, 'RelayConsumePolicyForAuthenticatedRole', {
      policyName: this.name({ type: 'iamPolicy', purpose: 'relay-queue-consume' }),
      statements: [
        new iam.PolicyStatement({
          sid: 'RelayQueueConsume',
          effect: iam.Effect.ALLOW,
          actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
          // ${aws:PrincipalTag/tenantId} and ${aws:PrincipalTag/userId} are
          // substituted at IAM evaluation time from the principal tags above.
          resources: [
            `arn:aws:sqs:*:${this.account}:derrops-\${aws:PrincipalTag/tenantId}-local-\${aws:PrincipalTag/userId}-*.fifo`,
          ],
        }),
      ],
    })
    authenticatedRole.attachInlinePolicy(relayConsumePolicy)

    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    })

  }
}
