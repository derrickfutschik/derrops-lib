import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import { Construct } from 'constructs'

/**
 * Infrastructure stack for SLAOps authentication resources
 *
 * This stack contains the Cognito User Pool and related authentication
 * infrastructure. These resources are long-lived and separate from
 * feature deployments.
 *
 * Features:
 * - Email-based authentication
 * - Password policy enforcement
 * - Account recovery via email
 * - User pool client for web applications
 *
 * These resources are exported via CloudFormation outputs and can be
 * referenced by other stacks (like the Amplify backend).
 */
export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // Create Cognito User Pool
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
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
      deletionProtection: true,
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
    })

    // Create User Pool Client for web applications
    this.userPoolClient = new cognito.UserPoolClient(this, 'SlaOpsUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'slaops-web-client',
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
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: Duration.days(30),
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
    })

    // Export important values via CloudFormation outputs
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
      description: 'Cognito User Pool Client ID',
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
  }
}
