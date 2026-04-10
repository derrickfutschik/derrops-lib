import { Injectable, Logger } from '@nestjs/common'
import {
  SQSClient,
  CreateQueueCommand,
  DeleteQueueCommand,
  SendMessageCommand,
} from '@aws-sdk/client-sqs'
import { config } from '@slaops/config'

/**
 * RelayQueueService — manages SQS FIFO queues for local-dev relay connections.
 *
 * ## Queue ownership modes
 *
 * platform (default):
 *   slaops-cloud creates the queue in the SLAOps AWS account at relay
 *   registration time and deletes it when the connection is removed.
 *   Queue name convention: slaops--{tenantId}--relay--middleware--{connId}.fifo
 *   The relay authenticates via Cognito Identity Pool → STS to consume.
 *
 * relay:
 *   The customer provisions their own SQS FIFO queue in their AWS account.
 *   They provide the queue URL at registration and grant the SlaOpsSqsPublishRole
 *   sqs:SendMessage access via a queue resource policy.
 *   slaops-cloud publishes cross-account using that role.
 *   The relay uses its own IAM credentials (instance profile, role, etc.) to consume.
 *   slaops-cloud does NOT create or delete the queue.
 *
 * ## FIFO delivery semantics
 *
 * All jobs for a relay share one MessageGroupId (= relayId) to preserve
 * submission order. MessageDeduplicationId = jobId prevents duplicate delivery
 * within the 5-minute dedup window (content-based dedup is also enabled as
 * a secondary safeguard).
 */
@Injectable()
export class RelayQueueService {
  private readonly logger = new Logger(RelayQueueService.name)
  private readonly sqs: SQSClient
  private readonly region: string

  constructor() {
    this.region = config['aws.region']
    this.sqs = new SQSClient({ region: this.region })
  }

  /**
   * Resolve the SQS queue URL for a new local-dev relay connection.
   *
   * platform mode: creates a new FIFO queue in the SLAOps account and returns its URL.
   * relay mode:    validates and returns the customer-provided URL unchanged.
   *                The customer is responsible for creating the queue and granting
   *                the SlaOpsSqsPublishRole sqs:SendMessage permission.
   */
  async resolveRelayQueue(
    mode: 'platform' | 'relay',
    tenantId: string,
    relayId: string,
    customerQueueUrl?: string,
  ): Promise<string> {
    if (mode === 'relay') {
      if (!customerQueueUrl) {
        throw new Error(
          'sqs_queue_mode=relay requires relay_sqs_queue_url to be provided',
        )
      }
      if (!customerQueueUrl.endsWith('.fifo')) {
        throw new Error(
          'relay_sqs_queue_url must be an SQS FIFO queue URL (must end in .fifo)',
        )
      }
      return customerQueueUrl
    }

    return this.createRelayQueue(tenantId, relayId)
  }

  /**
   * Provision a new FIFO queue in the SLAOps account.
   * Returns the queue URL to store on the connection record.
   */
  async createRelayQueue(tenantId: string, relayId: string): Promise<string> {
    const queueName = this.queueName(tenantId, relayId)

    const res = await this.sqs.send(
      new CreateQueueCommand({
        QueueName: queueName,
        Attributes: {
          FifoQueue: 'true',
          ContentBasedDeduplication: 'true',
          // Messages that are not consumed within 4 days are dropped.
          // A relay that has been offline for 4 days will miss queued jobs,
          // but slaops-cloud already has a 10-minute TTL on jobs so this is
          // effectively unreachable.
          MessageRetentionPeriod: String(config['relay.queue.message-retention-seconds']),
          // Relay visibility timeout: if the relay crashes mid-job, the message
          // reappears after this many seconds for reprocessing.
          VisibilityTimeout: String(config['relay.queue.visibility-timeout-seconds']),
        },
      }),
    )

    this.logger.log(`Provisioned SQS FIFO queue: ${queueName}`)
    return res.QueueUrl!
  }

  /**
   * Publish a relay job to the connection's SQS FIFO queue.
   *
   * MessageGroupId = relayId  — one ordered group per relay, preserving job submission order.
   * MessageDeduplicationId = jobId — prevents duplicate delivery within the 5-minute dedup window.
   */
  async publishJob(
    queueUrl: string,
    relayId: string,
    job: { id: string; request: object; tenant_id: string; user_id: string },
  ): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(job),
        MessageGroupId: relayId,
        MessageDeduplicationId: job.id,
      }),
    )
    this.logger.debug(`Published job ${job.id} to queue ${queueUrl}`)
  }

  /**
   * Delete the SQS queue when a platform-owned relay connection is removed.
   * relay-owned queues are never deleted by slaops-cloud.
   * SQS enforces a 60-second cooldown before a deleted name can be reused,
   * but since relay IDs are UUIDs the queue name is never reused.
   */
  async deleteRelayQueue(queueUrl: string): Promise<void> {
    try {
      await this.sqs.send(new DeleteQueueCommand({ QueueUrl: queueUrl }))
      this.logger.log(`Deleted SQS FIFO queue: ${queueUrl}`)
    } catch (err) {
      // Log but do not throw — connection record deletion should still proceed
      this.logger.error(`Failed to delete SQS queue ${queueUrl}: ${(err as Error).message}`)
    }
  }

  /** Returns the region this service provisions queues in. */
  getRegion(): string {
    return this.region
  }

  private queueName(tenantId: string, relayId: string): string {
    return `slaops--${tenantId}--relay--middleware--${relayId}.fifo`
  }
}
