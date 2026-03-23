import { randomUUID } from 'crypto'
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
 *
 * Install the AWS SDK before using this backend:
 *   pnpm add @aws-sdk/client-sqs @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
 */
export class SqsQueueStore implements QueueStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sqs: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dynamo: any
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
  }

  private async getSqs(): Promise<any> {
    if (!this.sqs) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SQSClient } = require('@aws-sdk/client-sqs')
      this.sqs = new SQSClient({})
    }
    return this.sqs
  }

  private async getDynamo(): Promise<any> {
    if (!this.dynamo) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')
      this.dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}))
    }
    return this.dynamo
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

    const dynamo = await this.getDynamo()
    const { PutCommand } = require('@aws-sdk/lib-dynamodb')
    await dynamo.send(new PutCommand({
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

    const sqs = await this.getSqs()
    const { SendMessageCommand } = require('@aws-sdk/client-sqs')
    await sqs.send(new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: id,
      MessageGroupId: 'relay-jobs',
      MessageDeduplicationId: id,
    }))

    return id
  }

  async getJob(id: string): Promise<QueueJobState | null> {
    const dynamo = await this.getDynamo()
    const { GetCommand } = require('@aws-sdk/lib-dynamodb')
    const { Item } = await dynamo.send(new GetCommand({
      TableName: this.tableName,
      Key: { id },
    }))

    if (!Item) return null

    return {
      id: Item.id,
      status: Item.status,
      tenantId: Item.tenantId,
      userId: Item.userId,
      request: JSON.parse(Item.request),
      result: Item.result ? JSON.parse(Item.result) : null,
      createdAt: Item.createdAt,
      completedAt: Item.completedAt ?? null,
      expiresAt: Item.expiresAt,
    }
  }

  async pollNext(): Promise<QueueJobClaim | null> {
    const sqs = await this.getSqs()
    const { ReceiveMessageCommand } = require('@aws-sdk/client-sqs')
    const { Messages } = await sqs.send(new ReceiveMessageCommand({
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
      const { DeleteMessageCommand } = require('@aws-sdk/client-sqs')
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      }))
      return null
    }

    // Mark as processing in DynamoDB
    const dynamo = await this.getDynamo()
    const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')
    await dynamo.send(new UpdateCommand({
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
    const dynamo = await this.getDynamo()
    const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')
    await dynamo.send(new UpdateCommand({
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

    const sqs = await this.getSqs()
    const { DeleteMessageCommand } = require('@aws-sdk/client-sqs')
    await sqs.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: ackHandle }))
  }

  async fail(id: string, ackHandle: string, error: Record<string, unknown>): Promise<void> {
    const dynamo = await this.getDynamo()
    const { UpdateCommand } = require('@aws-sdk/lib-dynamodb')
    await dynamo.send(new UpdateCommand({
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

    const sqs = await this.getSqs()
    const { DeleteMessageCommand } = require('@aws-sdk/client-sqs')
    await sqs.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: ackHandle }))
  }
}
