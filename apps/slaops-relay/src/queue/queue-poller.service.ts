import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { env } from '../env'
import type { CloudProxyRequestDto } from '../cloud-relay/dto/cloud-proxy-request.dto'
import { ProxyService } from '../cloud-relay/proxy.service'

/**
 * QueuePollerService — platform-queue delivery mode.
 *
 * Used when the relay cannot accept inbound connections.
 * The relay polls slaops-cloud for pending jobs, executes them via ProxyService,
 * and posts results back to slaops-cloud.
 *
 * Enabled by setting RELAY_PLATFORM_URL and RELAY_PLATFORM_TOKEN.
 * Disabled (no-op) when those env vars are absent.
 */
@Injectable()
export class QueuePollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueuePollerService.name)
  private running = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly proxyService: ProxyService) {}

  onModuleInit(): void {
    if (!env.platform.url || !env.platform.token) {
      this.logger.log(
        'RELAY_PLATFORM_URL / RELAY_PLATFORM_TOKEN not set — platform-queue polling disabled',
      )
      return
    }
    this.logger.log(
      `Platform-queue polling enabled → ${env.platform.url} (interval: ${env.platform.pollIntervalMs}ms)`,
    )
    this.running = true
    void this.pollLoop()
  }

  onModuleDestroy(): void {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.pollOnce()
      } catch (err) {
        this.logger.error(`Platform-queue poll error: ${(err as Error).message}`)
      }

      // Sleep before next poll
      await new Promise<void>(resolve => {
        this.timer = setTimeout(resolve, env.platform.pollIntervalMs)
      })
    }
  }

  private async pollOnce(): Promise<void> {
    const baseUrl = env.platform.url!
    const token = env.platform.token!

    // Claim a job from slaops-cloud
    let res: Response
    try {
      res = await fetch(`${baseUrl}/cloud-relay/queue/next`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      })
    } catch (err) {
      this.logger.warn(`Failed to reach slaops-cloud: ${(err as Error).message}`)
      return
    }

    if (res.status === 204 || res.status === 404) {
      return // nothing to process
    }

    if (!res.ok) {
      this.logger.warn(`slaops-cloud returned ${res.status} on queue/next`)
      return
    }

    const job = (await res.json()) as {
      id: string
      request: CloudProxyRequestDto
      tenant_id: string
      user_id: string
    }

    if (!job?.id) return

    this.logger.log(`Claimed job ${job.id} — executing`)

    // Execute the request
    let result: object
    let failed = false
    try {
      result = await this.proxyService.proxy(job.request, job.user_id, job.tenant_id)
    } catch (err) {
      failed = true
      result = { error: (err as Error).message }
      this.logger.warn(`Job ${job.id} failed: ${(err as Error).message}`)
    }

    // Post result back to slaops-cloud
    try {
      const postRes = await fetch(`${baseUrl}/cloud-relay/job/${job.id}/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ result, failed }),
        signal: AbortSignal.timeout(10_000),
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
}
