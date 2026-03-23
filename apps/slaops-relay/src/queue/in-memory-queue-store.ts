import { randomUUID } from 'crypto'
import type { QueueJobClaim, QueueJobState, QueueStore } from './queue-store'

export class InMemoryQueueStore implements QueueStore {
  private readonly jobs = new Map<string, QueueJobState>()
  private readonly pending: string[] = []

  async enqueue(
    request: Record<string, unknown>,
    tenantId: string,
    userId: string,
    ttlMs: number,
  ): Promise<string> {
    const id = randomUUID()
    const now = new Date()
    this.jobs.set(id, {
      id,
      status: 'pending',
      tenantId,
      userId,
      request,
      result: null,
      createdAt: now.toISOString(),
      completedAt: null,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    })
    this.pending.push(id)
    return id
  }

  async getJob(id: string): Promise<QueueJobState | null> {
    const job = this.jobs.get(id)
    if (!job) return null
    if (new Date(job.expiresAt) < new Date()) {
      this.jobs.delete(id)
      return null
    }
    return job
  }

  async pollNext(): Promise<QueueJobClaim | null> {
    while (this.pending.length > 0) {
      const id = this.pending.shift()!
      const job = this.jobs.get(id)
      if (!job || new Date(job.expiresAt) < new Date()) continue

      job.status = 'processing'
      return { job, ackHandle: id }
    }
    return null
  }

  async complete(id: string, _ackHandle: string, result: Record<string, unknown>): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) return
    job.status = 'completed'
    job.result = result
    job.completedAt = new Date().toISOString()
  }

  async fail(id: string, _ackHandle: string, error: Record<string, unknown>): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) return
    job.status = 'failed'
    job.result = error
    job.completedAt = new Date().toISOString()
  }

  /** Remove expired jobs. Called periodically by QueueService. */
  evictExpired(): void {
    const now = new Date()
    for (const [id, job] of this.jobs) {
      if (new Date(job.expiresAt) < now) {
        this.jobs.delete(id)
      }
    }
  }
}
