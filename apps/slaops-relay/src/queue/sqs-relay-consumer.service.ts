import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, MessageSystemAttributeName } from '@aws-sdk/client-sqs'
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
 * Credential modes (in priority order):
 *   1. Cognito Identity Pool — when RELAY_COGNITO_IDENTITY_POOL_ID +
 *      RELAY_COGNITO_USER_POOL_ID are set. Credentials refreshed automatically.
 *   2. AWS SDK default credential chain — instance role, ECS task role,
 *      AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars, etc.
 *
 * Enabled by setting RELAY_PLATFORM_SQS_QUEUE_URL (or the alias SQS_QUEUE_URL).
 * No-op when absent.
 *
 * Message format accepted:
 *   Both HAR-wrapped CloudProxyRequestDto and the simpler slaops-cloud wire
 *   format {id, request: {method, url, headers, queryParams, body, contentType},
 *   tenant_id, user_id} are accepted. The simpler format is normalised to HAR
 *   before being passed to ProxyService so HAR remains the canonical internal
 *   representation.
 */
@Injectable()
export class SqsRelayConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsRelayConsumerService.name)
  private running = false
  private sqsClient: SQSClient | null = null

  /** Current temporary AWS credentials — in memory only, never written to disk. */
  private credentials: AwsCredentials | null = null
  /** Current Cognito id_token — refreshed via refresh_token when expired. */
  private idToken: string | null = null
  /** Whether to use Cognito credential management (vs. AWS SDK default chain). */
  private useCognito = false

  constructor(private readonly proxyService: ProxyService) {}

  onModuleInit(): void {
    if (!env.platformSqs.queueUrl) {
      this.logger.log(JSON.stringify({
        event: 'sqs_consumer_disabled',
        reason: 'RELAY_PLATFORM_SQS_QUEUE_URL / SQS_QUEUE_URL not set',
      }))
      return
    }

    const hasCognito = !!(env.cognito.identityPoolId && env.cognito.userPoolId)
    this.useCognito = hasCognito

    if (hasCognito) {
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
    }

    this.logger.log(JSON.stringify({
      event: 'sqs_consumer_starting',
      queue_url: env.platformSqs.queueUrl,
      region: env.platformSqs.region,
      credential_mode: hasCognito ? 'cognito' : 'sdk-default-chain',
      relay_id: env.jwt.relayId ?? null,
    }))

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
    process.env.RELAY_COGNITO_ID_TOKEN = json.id_token
    this.logger.log(JSON.stringify({ event: 'cognito_id_token_refreshed' }))
  }

  /** Exchange the current id_token for new temporary AWS credentials via the Identity Pool. */
  private async refreshCredentials(): Promise<void> {
    const { identityPoolId, region, userPoolId } = env.cognito

    if (!this.idToken || this.isIdTokenExpired()) {
      this.logger.log(JSON.stringify({ event: 'cognito_id_token_expired', action: 'refreshing' }))
      await this.refreshIdToken()
    }

    const endpoint = `https://cognito-identity.${region}.amazonaws.com/`
    const providerKey = `cognito-idp.${region}.amazonaws.com/${userPoolId}`
    const logins = { [providerKey]: this.idToken! }

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

    this.logger.log(JSON.stringify({
      event: 'aws_credentials_refreshed',
      expires_at: this.credentials.expiration.toISOString(),
    }))

    this.sqsClient = this.buildSqsClient(this.credentials)
  }

  private buildSqsClient(creds?: AwsCredentials): SQSClient {
    return new SQSClient({
      region: env.platformSqs.region,
      ...(creds
        ? {
            credentials: {
              accessKeyId: creds.accessKeyId,
              secretAccessKey: creds.secretAccessKey,
              sessionToken: creds.sessionToken,
            },
          }
        : {}),
    })
  }

  /** Returns a ready SQS client, refreshing credentials first if needed. */
  private async getSqsClient(): Promise<SQSClient> {
    if (this.useCognito) {
      if (!this.credentials || this.isExpiringSoon(this.credentials)) {
        await this.refreshCredentials()
      }
      if (!this.sqsClient) {
        this.sqsClient = this.buildSqsClient(this.credentials!)
      }
    } else {
      // AWS SDK default credential chain — build once and reuse
      if (!this.sqsClient) {
        this.sqsClient = this.buildSqsClient()
      }
    }
    return this.sqsClient
  }

  // ---------------------------------------------------------------------------
  // Message format normalisation
  // ---------------------------------------------------------------------------

  /**
   * Normalise the slaops-cloud wire format to a CloudProxyRequestDto.
   *
   * slaops-cloud sends:
   *   { method, url, headers: Record<string,string>, queryParams: Record<string,string>,
   *     body: string|null, contentType: string|null }
   *
   * ProxyService expects a HAR-wrapped CloudProxyRequestDto:
   *   { request: HarRequestDto }
   *
   * HAR is the canonical internal representation — this is the single point of
   * conversion between the wire format and the processing layer.
   */
  private normaliseToHar(raw: Record<string, unknown>): CloudProxyRequestDto {
    const method = (raw['method'] as string | undefined) ?? 'GET'
    const url = (raw['url'] as string | undefined) ?? ''
    const rawHeaders = (raw['headers'] ?? {}) as Record<string, string>
    const rawQueryParams = (raw['queryParams'] ?? {}) as Record<string, string>
    const body = raw['body'] as string | null | undefined
    const contentType = raw['contentType'] as string | null | undefined

    // Convert headers object to HAR name/value array
    const headers = Object.entries(rawHeaders).map(([name, value]) => ({ name, value: String(value) }))

    // queryParams may already be embedded in the URL — emit them into queryString
    // only when the URL does not already contain a query string, to avoid duplication.
    const hasQueryInUrl = url.includes('?')
    const queryString = hasQueryInUrl
      ? []
      : Object.entries(rawQueryParams).map(([name, value]) => ({ name, value: String(value) }))

    const bodyText = body ?? undefined
    const bodyBytes = bodyText !== undefined ? Buffer.byteLength(bodyText) : -1

    return {
      request: {
        method,
        url,
        httpVersion: 'HTTP/1.1',
        headers,
        queryString,
        cookies: [],
        headersSize: -1,
        bodySize: bodyBytes,
        ...(bodyText !== undefined
          ? { postData: { mimeType: contentType ?? 'application/octet-stream', text: bodyText } }
          : {}),
      },
    } as unknown as CloudProxyRequestDto
  }

  /**
   * Determine whether the parsed job.request is already a HAR-wrapped
   * CloudProxyRequestDto (has a nested `request` key with `httpVersion`) or
   * the simpler slaops-cloud wire format, and normalise accordingly.
   */
  private toCloudProxyRequest(jobRequest: Record<string, unknown>): CloudProxyRequestDto {
    // HAR-wrapped format: { request: { method, url, httpVersion, headers: [...], ... } }
    const inner = jobRequest['request'] as Record<string, unknown> | undefined
    if (inner && typeof inner === 'object' && typeof inner['httpVersion'] === 'string') {
      return jobRequest as unknown as CloudProxyRequestDto
    }
    // Simple wire format: { method, url, headers: {}, queryParams: {}, ... }
    return this.normaliseToHar(jobRequest)
  }

  // ---------------------------------------------------------------------------
  // Consume loop
  // ---------------------------------------------------------------------------

  private async consumeLoop(): Promise<void> {
    while (this.running) {
      try {
        const sqs = await this.getSqsClient()
        const response = await sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: env.platformSqs.queueUrl,
            WaitTimeSeconds: 20,
            MaxNumberOfMessages: 1,
            VisibilityTimeout: 120,
            MessageSystemAttributeNames: [MessageSystemAttributeName.ApproximateReceiveCount],
          }),
        )

        const messages: Array<{ Body?: string; ReceiptHandle?: string; MessageId?: string; Attributes?: Record<string, string> }> =
          response.Messages ?? []

        if (messages.length === 0) {
          this.logger.debug(JSON.stringify({ event: 'sqs_poll_empty', queue_url: env.platformSqs.queueUrl }))
          continue
        }

        this.logger.log(JSON.stringify({
          event: 'sqs_messages_received',
          count: messages.length,
          message_ids: messages.map(m => m.MessageId),
        }))

        for (const message of messages) {
          if (!this.running) break
          void this.processMessage(message)
        }
      } catch (err) {
        if (!this.running) break
        this.logger.error(JSON.stringify({
          event: 'sqs_consume_error',
          error: (err as Error).message,
          stack: (err as Error).stack,
        }))
        await new Promise<void>(r => setTimeout(r, 2_000))
      }
    }

    this.logger.log(JSON.stringify({ event: 'sqs_consumer_stopped' }))
  }

  private async processMessage(message: {
    Body?: string
    ReceiptHandle?: string
    MessageId?: string
    Attributes?: Record<string, string>
  }): Promise<void> {
    const receiptHandle = message.ReceiptHandle
    const receiveCount = message.Attributes?.[MessageSystemAttributeName.ApproximateReceiveCount] ?? 'unknown'

    this.logger.log(JSON.stringify({
      event: 'sqs_message_received',
      message_id: message.MessageId,
      body_length: message.Body?.length ?? 0,
      receive_count: receiveCount,
    }))

    // ── Parse ────────────────────────────────────────────────────────────────
    let rawJob: Record<string, unknown>
    try {
      rawJob = JSON.parse(message.Body ?? '{}') as Record<string, unknown>
    } catch (err) {
      this.logger.warn(JSON.stringify({
        event: 'sqs_message_parse_error',
        message_id: message.MessageId,
        error: (err as Error).message,
        raw_body: message.Body,
      }))
      await this.deleteMessage(receiptHandle, message.MessageId)
      return
    }

    const jobId = rawJob['id'] as string | undefined
    const tenantId = rawJob['tenant_id'] as string | undefined
    const userId = rawJob['user_id'] as string | undefined
    const rawRequest = rawJob['request'] as Record<string, unknown> | undefined

    if (!jobId || !rawRequest) {
      this.logger.warn(JSON.stringify({
        event: 'sqs_message_invalid',
        message_id: message.MessageId,
        reason: !jobId ? 'missing job id' : 'missing request',
        raw_job: rawJob,
      }))
      await this.deleteMessage(receiptHandle, message.MessageId)
      return
    }

    // ── Normalise to HAR ─────────────────────────────────────────────────────
    let proxyRequest: CloudProxyRequestDto
    try {
      proxyRequest = this.toCloudProxyRequest(rawRequest)
    } catch (err) {
      this.logger.warn(JSON.stringify({
        event: 'sqs_message_normalise_error',
        job_id: jobId,
        message_id: message.MessageId,
        error: (err as Error).message,
        raw_request: rawRequest,
      }))
      await this.deleteMessage(receiptHandle, message.MessageId)
      return
    }

    this.logger.log(JSON.stringify({
      event: 'job_claimed',
      job_id: jobId,
      tenant_id: tenantId,
      user_id: userId,
      method: proxyRequest.request.method,
      url: proxyRequest.request.url,
      header_count: proxyRequest.request.headers.length,
      query_string_count: proxyRequest.request.queryString.length,
    }))

    // ── Execute proxy ────────────────────────────────────────────────────────
    let result: object
    let failed = false
    try {
      result = await this.proxyService.proxy(proxyRequest, userId ?? '', tenantId ?? '')
      const r = result as { status?: number; durationMs?: number; error?: string }
      this.logger.log(JSON.stringify({
        event: 'job_proxy_complete',
        job_id: jobId,
        status: r.status,
        duration_ms: r.durationMs,
        failed: false,
      }))
    } catch (err) {
      failed = true
      result = { error: (err as Error).message }
      this.logger.warn(JSON.stringify({
        event: 'job_proxy_error',
        job_id: jobId,
        error: (err as Error).message,
        stack: (err as Error).stack,
      }))
    }

    // ── Deliver result ───────────────────────────────────────────────────────
    if (env.platform.url && env.platform.token) {
      const resultUrl = `${env.platform.url}/cloud-relay/job/${jobId}/result`
      this.logger.log(JSON.stringify({
        event: 'job_result_delivering',
        job_id: jobId,
        result_url: resultUrl,
        failed,
      }))
      try {
        const postRes = await fetch(resultUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.platform.token}`,
          },
          body: JSON.stringify({ result, failed }),
          signal: AbortSignal.timeout(15_000),
        })
        if (!postRes.ok) {
          let errorBody: string
          try { errorBody = await postRes.text() } catch { errorBody = '' }
          this.logger.warn(JSON.stringify({
            event: 'job_result_deliver_failed',
            job_id: jobId,
            http_status: postRes.status,
            error_body: errorBody,
          }))
        } else {
          this.logger.log(JSON.stringify({
            event: 'job_result_delivered',
            job_id: jobId,
            failed,
          }))
        }
      } catch (err) {
        this.logger.error(JSON.stringify({
          event: 'job_result_deliver_error',
          job_id: jobId,
          error: (err as Error).message,
        }))
      }
    } else {
      this.logger.debug(JSON.stringify({
        event: 'job_result_skipped',
        reason: 'RELAY_PLATFORM_URL / RELAY_PLATFORM_TOKEN not set',
        job_id: jobId,
      }))
    }

    await this.deleteMessage(receiptHandle, message.MessageId)
  }

  private async deleteMessage(receiptHandle: string | undefined, messageId?: string): Promise<void> {
    if (!receiptHandle) return
    try {
      const sqs = await this.getSqsClient()
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: env.platformSqs.queueUrl,
        ReceiptHandle: receiptHandle,
      }))
      this.logger.log(JSON.stringify({
        event: 'sqs_message_deleted',
        message_id: messageId,
      }))
    } catch (err) {
      this.logger.error(JSON.stringify({
        event: 'sqs_message_delete_error',
        message_id: messageId,
        error: (err as Error).message,
      }))
    }
  }
}
