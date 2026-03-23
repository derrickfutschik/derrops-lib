export type QueueJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type QueueJobState = {
  id: string
  status: QueueJobStatus
  tenantId: string
  userId: string
  /** The full CloudProxyRequestDto payload */
  request: Record<string, unknown>
  /** CloudProxyResponseDto or CloudProxyErrorDto once done */
  result: Record<string, unknown> | null
  createdAt: string
  completedAt: string | null
  expiresAt: string
}

/** Returned by pollNext() — contains the job and an ack handle for backends that need it (e.g. SQS). */
export type QueueJobClaim = {
  job: QueueJobState
  /** Opaque handle passed back to complete()/fail() so the store can ack/delete the message. */
  ackHandle: string
}

/**
 * Pluggable queue backend interface.
 *
 * Two implementations are provided:
 *  - InMemoryQueueStore  — default, zero dependencies
 *  - SqsQueueStore       — AWS: SQS for the work channel, DynamoDB for job state
 *
 * Register custom implementations via QueueStoreRegistry before bootstrap().
 */
export interface QueueStore {
  /**
   * Persist a new job and make it available for processing.
   * Returns the job ID.
   */
  enqueue(
    request: Record<string, unknown>,
    tenantId: string,
    userId: string,
    ttlMs: number,
  ): Promise<string>

  /** Retrieve the current state of a job. Returns null if not found or expired. */
  getJob(id: string): Promise<QueueJobState | null>

  /**
   * Block until a job is available and return it in a claimed state,
   * or return null if no job arrived within the implementation's poll window.
   *
   * For InMemoryQueueStore this returns immediately.
   * For SqsQueueStore this does a 20-second long-poll.
   */
  pollNext(): Promise<QueueJobClaim | null>

  /** Mark a claimed job as successfully completed. */
  complete(id: string, ackHandle: string, result: Record<string, unknown>): Promise<void>

  /** Mark a claimed job as failed. */
  fail(id: string, ackHandle: string, error: Record<string, unknown>): Promise<void>
}

export class QueueStoreError extends Error {
  constructor(
    message: string,
    public readonly code: 'STORE_UNAVAILABLE' | 'JOB_NOT_FOUND' | 'INVALID_STATE',
  ) {
    super(message)
    this.name = 'QueueStoreError'
  }
}
