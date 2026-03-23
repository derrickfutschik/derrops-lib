import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { env } from '../env'
import { ProxyService } from '../cloud-relay/proxy.service'
import type { CloudProxyRequestDto } from '../cloud-relay/dto/cloud-proxy-request.dto'
import type { QueueJobState } from './queue-store'
import { queueStoreRegistry } from './queue-store-registry'
import type { QueueStore } from './queue-store'

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name)
  private readonly store: QueueStore
  private active = true
  private cleanupTimer: ReturnType<typeof setInterval> | undefined
  private readonly workerPromises: Promise<void>[] = []

  constructor(private readonly proxyService: ProxyService) {
    this.store = queueStoreRegistry.create()
  }

  onModuleInit(): void {
    // Start worker pool
    for (let i = 0; i < env.queue.workerConcurrency; i++) {
      this.workerPromises.push(this.runWorker(i))
    }

    // Evict expired jobs from in-memory store periodically
    this.cleanupTimer = setInterval(() => {
      if ('evictExpired' in this.store && typeof (this.store as any).evictExpired === 'function') {
        ;(this.store as any).evictExpired()
      }
    }, 60_000)
  }

  async onModuleDestroy(): Promise<void> {
    this.active = false
    clearInterval(this.cleanupTimer)
    await Promise.allSettled(this.workerPromises)
  }

  async enqueue(
    request: CloudProxyRequestDto,
    tenantId: string,
    userId: string,
  ): Promise<{ jobId: string }> {
    const jobId = await this.store.enqueue(
      request as unknown as Record<string, unknown>,
      tenantId,
      userId,
      env.queue.jobTtlMs,
    )
    return { jobId }
  }

  async getJob(id: string): Promise<QueueJobState | null> {
    return this.store.getJob(id)
  }

  private async runWorker(index: number): Promise<void> {
    this.logger.debug(`Queue worker ${index} started`)
    while (this.active) {
      try {
        const claim = await this.store.pollNext()
        if (!claim) {
          // In-memory store returns null immediately when empty — back off briefly
          await sleep(500)
          continue
        }

        const { job, ackHandle } = claim
        this.logger.debug(`Worker ${index} processing job ${job.id}`)

        try {
          const result = await this.proxyService.proxy(
            job.request as unknown as CloudProxyRequestDto,
            job.userId,
            job.tenantId,
          )
          await this.store.complete(job.id, ackHandle, result as unknown as Record<string, unknown>)
        } catch (err) {
          const error = { error: (err as Error).message, code: 'INTERNAL_ERROR', durationMs: 0 }
          await this.store.fail(job.id, ackHandle, error)
        }
      } catch (err) {
        this.logger.error(`Worker ${index} error: ${(err as Error).message}`)
        await sleep(2000)
      }
    }
    this.logger.debug(`Queue worker ${index} stopped`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
