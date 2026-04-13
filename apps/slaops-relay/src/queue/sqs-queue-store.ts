import { randomUUID } from 'crypto'
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { QueueJobClaim, QueueJobState, QueueStore } from './queue-store'
import { QueueStoreError } from './queue-store'

/**
 * AWS SQS + DynamoDB queue backend.
 *
 * Architecture:
 *  - SQS FIFO queue        — carries job IDs (the work channel)
 *  - DynamoDB table        — stores full job state (request payload, status, result)
 *
 * Environment variables required when RELAY_QUEUE_BACKEND=sqs:
 *  RELAY_SQS_QUEUE_URL     — SQS FIFO queue URL
 *  RELAY_DYNAMODB_TABLE    — DynamoDB table name for job state
 *  AWS_REGION              — AWS region (or use instance role / env)
 *
 * IAM permissions required by the relay's execution role:
 *  sqs:SendMessage, sqs:ReceiveMessage, sqs:DeleteMessage
 *  dynamodb:PutItem, dynamodb:GetItem, dynamodb:UpdateItem
 */
export class SqsQueueStore implements QueueStore {
  private readonly sqs: SQSClient
  private readonly dynamo: DynamoDBDocumentClient
  private readonly queueUrl: string
  private readonly tableName: string

  constructor(env: NodeJS.ProcessEnv) {
    this.queueUrl = env.RELAY_SQS_QUEUE_URL ?? ''
    this.tableName = env.RELAY_DYNAMODB_TABLE ?? ''

    if (!this.queueUrl || !this.tableName) {
      throw new QueueStoreError(
        'RELAY_SQS_QUEUE_URL and RELAY_DYNAMODB_TABLE must be set for the sqs queue backend',
        'STORE_UNAVAILABLE',
      )
    }

    this.sqs = new SQSClient({})
    this.dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}))
  }

  async enqueue(
    request: Record<string, unknown>,
    tenantId: string,
    userId: string,
    ttlMs: number,
  ): Promise<string> {
    const id = randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString()
    const ttlEpoch = Math.floor((now.getTime() + ttlMs) / 1000)

    await this.dynamo.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        id,
        status: 'pending',
        tenantId,
        userId,
        request: JSON.stringify(request),
        result: null,
        createdAt: now.toISOString(),
        completedAt: null,
        expiresAt,
        ttl: ttlEpoch, // DynamoDB TTL attribute (epoch seconds)
      },
    }))

    await this.sqs.send(new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: id,
      MessageGroupId: 'relay-jobs',
      MessageDeduplicationId: id,
    }))

    return id
  }

  async getJob(id: string): Promise<QueueJobState | null> {
    const { Item } = await this.dynamo.send(new GetCommand({
      TableName: this.tableName,
      Key: { id },
    }))

    if (!Item) return null

    return {
      id: Item['id'] as string,
      status: Item['status'] as QueueJobState['status'],
      tenantId: Item['tenantId'] as string,
      userId: Item['userId'] as string,
      request: JSON.parse(Item['request'] as string) as Record<string, unknown>,
      result: Item['result'] ? JSON.parse(Item['result'] as string) as Record<string, unknown> : null,
      createdAt: Item['createdAt'] as string,
      completedAt: (Item['completedAt'] as string | null) ?? null,
      expiresAt: Item['expiresAt'] as string,
    }
  }

  async pollNext(): Promise<QueueJobClaim | null> {
    const { Messages } = await this.sqs.send(new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20, // long poll
      VisibilityTimeout: 120,
    }))

    if (!Messages?.length) return null

    const message = Messages[0]
    const jobId = message.Body!
    const receiptHandle = message.ReceiptHandle!

    const job = await this.getJob(jobId)
    if (!job) {
      // Job expired — delete message and signal nothing to process
      await this.sqs.send(new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      }))
      return null
    }

    // Mark as processing in DynamoDB
    await this.dynamo.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { id: jobId },
      UpdateExpression: 'SET #s = :processing',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':processing': 'processing' },
    }))

    job.status = 'processing'
    return { job, ackHandle: receiptHandle }
  }

  async complete(id: string, ackHandle: string, result: Record<string, unknown>): Promise<void> {
    await this.dynamo.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { id },
      UpdateExpression: 'SET #s = :completed, #r = :result, completedAt = :completedAt',
      ExpressionAttributeNames: { '#s': 'status', '#r': 'result' },
      ExpressionAttributeValues: {
        ':completed': 'completed',
        ':result': JSON.stringify(result),
        ':completedAt': new Date().toISOString(),
      },
    }))

    await this.sqs.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: ackHandle }))
  }

  async fail(id: string, ackHandle: string, error: Record<string, unknown>): Promise<void> {
    await this.dynamo.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { id },
      UpdateExpression: 'SET #s = :failed, #r = :result, completedAt = :completedAt',
      ExpressionAttributeNames: { '#s': 'status', '#r': 'result' },
      ExpressionAttributeValues: {
        ':failed': 'failed',
        ':result': JSON.stringify(error),
        ':completedAt': new Date().toISOString(),
      },
    }))

    await this.sqs.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: ackHandle }))
  }
}
