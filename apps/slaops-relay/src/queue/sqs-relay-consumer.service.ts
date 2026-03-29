import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { env } from '../env'
import type { CloudProxyRequestDto } from '../cloud-relay/dto/cloud-proxy-request.dto'
import { ProxyService } from '../cloud-relay/proxy.service'

interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  expiration: Date
}

/**
 * SqsRelayConsumerService — platform-queue delivery via a dedicated SQS queue.
 *
 * When a relay is registered with slaops-cloud as type=local-dev, the platform
 * provisions a dedicated SQS queue for that relay. slaops-cloud publishes jobs
 * to the queue; the relay consumes via SQS long-poll, executes them via
 * ProxyService, and posts results back to slaops-cloud over HTTP.
 *
 * AWS credentials are obtained via the Cognito Identity Pool (exchanging the
 * Cognito id_token for temporary STS credentials). They are held in memory
 * only and refreshed automatically before they expire. The relay never reads
 * or writes AWS credentials to disk.
 *
 * Credential refresh lifecycle:
 *   1. SQS loop checks expiry before each ReceiveMessage call.
 *   2. If credentials expire within 5 minutes, refreshCredentials() is called.
 *   3. refreshCredentials() calls the Identity Pool with the current id_token.
 *   4. If the id_token itself is expired, refreshIdToken() is called first
 *      using the stored refresh_token (valid for 30 days).
 *
 * Enabled by setting RELAY_PLATFORM_SQS_QUEUE_URL. No-op when absent.
 */
@Injectable()
export class SqsRelayConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsRelayConsumerService.name)
  private running = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sqsClient: any = null

  /** Current temporary AWS credentials — in memory only, never written to disk. */
  private credentials: AwsCredentials | null = null
  /** Current Cognito id_token — refreshed via refresh_token when expired. */
  private idToken: string | null = null

  constructor(private readonly proxyService: ProxyService) {}

  onModuleInit(): void {
    if (!env.platformSqs.queueUrl) {
      this.logger.log('RELAY_PLATFORM_SQS_QUEUE_URL not set — SQS relay consumer disabled')
      return
    }

    if (!env.cognito.identityPoolId || !env.cognito.userPoolId) {
      this.logger.error(
        'RELAY_COGNITO_IDENTITY_POOL_ID / RELAY_COGNITO_USER_POOL_ID not set — SQS consumer cannot start',
      )
      return
    }

    // Seed with initial credentials injected by `slaops relay start`
    if (
      env.platformSqs.initialAccessKeyId &&
      env.platformSqs.initialSecretAccessKey &&
      env.platformSqs.initialSessionToken &&
      env.platformSqs.initialCredsExpiry
    ) {
      this.credentials = {
        accessKeyId: env.platformSqs.initialAccessKeyId,
        secretAccessKey: env.platformSqs.initialSecretAccessKey,
        sessionToken: env.platformSqs.initialSessionToken,
        expiration: new Date(env.platformSqs.initialCredsExpiry),
      }
    }

    this.idToken = env.cognito.idToken ?? null
    this.running = true
    void this.consumeLoop()
  }

  onModuleDestroy(): void {
    this.running = false
  }

  // ---------------------------------------------------------------------------
  // Credential management
  // ---------------------------------------------------------------------------

  private isExpiringSoon(creds: AwsCredentials, bufferMs = 5 * 60 * 1000): boolean {
    return Date.now() > creds.expiration.getTime() - bufferMs
  }

  private isIdTokenExpired(): boolean {
    // id_token expiry is the same as access_token expiry — use the credentials
    // expiry as a proxy. If we have no credentials yet, assume it may be expired.
    if (!this.credentials) return true
    return this.isExpiringSoon(this.credentials, 0)
  }

  /** Refresh the Cognito id_token using the stored refresh_token. */
  private async refreshIdToken(): Promise<void> {
    const { refreshToken, clientId, domain } = env.cognito
    if (!refreshToken || !clientId) {
      throw new Error('Cannot refresh id_token: RELAY_COGNITO_REFRESH_TOKEN or RELAY_COGNITO_CLIENT_ID not set')
    }

    const res = await fetch(`${domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken,
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.status.toString())
      throw new Error(`Cognito token refresh failed: ${text}`)
    }

    const json = await res.json() as { id_token: string; expires_in: number }
    this.idToken = json.id_token
    // Update process.env so that any future restart picks up the fresh token
    process.env.RELAY_COGNITO_ID_TOKEN = json.id_token
    this.logger.log('Cognito id_token refreshed')
  }

  /** Exchange the current id_token for new temporary AWS credentials via the Identity Pool. */
  private async refreshCredentials(): Promise<void> {
    const { identityPoolId, region, userPoolId } = env.cognito

    if (!this.idToken || this.isIdTokenExpired()) {
      this.logger.log('id_token expired — refreshing via refresh_token')
      await this.refreshIdToken()
    }

    const endpoint = `https://cognito-identity.${region}.amazonaws.com/`
    const providerKey = `cognito-idp.${region}.amazonaws.com/${userPoolId}`
    const logins = { [providerKey]: this.idToken! }

    // GetId (stable per user+pool — cheap to call repeatedly)
    const idRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityService.GetId',
      },
      body: JSON.stringify({ IdentityPoolId: identityPoolId, Logins: logins }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!idRes.ok) throw new Error(`Identity Pool GetId failed: ${idRes.status}`)
    const { IdentityId } = await idRes.json() as { IdentityId: string }

    // GetCredentialsForIdentity
    const credsRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity',
      },
      body: JSON.stringify({ IdentityId, Logins: logins }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!credsRes.ok) throw new Error(`Identity Pool GetCredentialsForIdentity failed: ${credsRes.status}`)

    const { Credentials } = await credsRes.json() as {
      Credentials: { AccessKeyId: string; SecretKey: string; SessionToken: string; Expiration: number }
    }

    this.credentials = {
      accessKeyId: Credentials.AccessKeyId,
      secretAccessKey: Credentials.SecretKey,
      sessionToken: Credentials.SessionToken,
      expiration: new Date(Credentials.Expiration * 1000),
    }

    this.logger.log(`AWS credentials refreshed — valid until ${this.credentials.expiration.toISOString()}`)

    // Rebuild the SQS client with the new credentials
    this.sqsClient = this.buildSqsClient(this.credentials)
  }

  private buildSqsClient(creds: AwsCredentials): unknown {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SQSClient } = require('@aws-sdk/client-sqs')
    return new SQSClient({
      region: env.platformSqs.region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      },
    })
  }

  /** Returns a ready SQS client, refreshing credentials first if needed. */
  private async getSqsClient(): Promise<unknown> {
    if (!this.credentials || this.isExpiringSoon(this.credentials)) {
      await this.refreshCredentials()
    }
    if (!this.sqsClient) {
      this.sqsClient = this.buildSqsClient(this.credentials!)
    }
    return this.sqsClient
  }

  // ---------------------------------------------------------------------------
  // Consume loop
  // ---------------------------------------------------------------------------

  private async consumeLoop(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ReceiveMessageCommand } = require('@aws-sdk/client-sqs')

    while (this.running) {
      try {
        const sqs = await this.getSqsClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { Messages } = await (sqs as any).send(
          new ReceiveMessageCommand({
            QueueUrl: env.platformSqs.queueUrl,
            WaitTimeSeconds: 20, // long-poll
            MaxNumberOfMessages: 1,
            VisibilityTimeout: 120,
          }),
        )

        for (const message of Messages ?? []) {
          if (!this.running) break
          void this.processMessage(message)
        }
      } catch (err) {
        if (!this.running) break
        this.logger.error(`SQS consume error: ${(err as Error).message}`)
        await new Promise<void>(r => setTimeout(r, 2_000))
      }
    }
  }

  private async processMessage(message: { Body?: string; ReceiptHandle?: string }): Promise<void> {
    const receiptHandle = message.ReceiptHandle
    let job: { id: string; request: CloudProxyRequestDto; tenant_id: string; user_id: string }

    try {
      job = JSON.parse(message.Body ?? '{}')
    } catch {
      this.logger.warn('Received unparseable SQS message — discarding')
      await this.deleteMessage(receiptHandle)
      return
    }

    if (!job?.id) {
      this.logger.warn('SQS message missing job id — discarding')
      await this.deleteMessage(receiptHandle)
      return
    }

    this.logger.log(`Claimed job ${job.id} via SQS`)

    let result: object
    let failed = false
    try {
      result = await this.proxyService.proxy(job.request, job.user_id, job.tenant_id)
    } catch (err) {
      failed = true
      result = { error: (err as Error).message }
      this.logger.warn(`Job ${job.id} failed: ${(err as Error).message}`)
    }

    if (env.platform.url && env.platform.token) {
      try {
        const postRes = await fetch(`${env.platform.url}/cloud-relay/job/${job.id}/result`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.platform.token}`,
          },
          body: JSON.stringify({ result, failed }),
          signal: AbortSignal.timeout(15_000),
        })
        if (!postRes.ok) {
          this.logger.warn(`Failed to deliver result for job ${job.id}: HTTP ${postRes.status}`)
        } else {
          this.logger.log(`Job ${job.id} result delivered (failed=${failed})`)
        }
      } catch (err) {
        this.logger.error(`Failed to post result for job ${job.id}: ${(err as Error).message}`)
      }
    }

    await this.deleteMessage(receiptHandle)
  }

  private async deleteMessage(receiptHandle: string | undefined): Promise<void> {
    if (!receiptHandle) return
    try {
      const sqs = await this.getSqsClient()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DeleteMessageCommand } = require('@aws-sdk/client-sqs')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sqs as any).send(new DeleteMessageCommand({
        QueueUrl: env.platformSqs.queueUrl,
        ReceiptHandle: receiptHandle,
      }))
    } catch (err) {
      this.logger.error(`Failed to delete SQS message: ${(err as Error).message}`)
    }
  }
}
