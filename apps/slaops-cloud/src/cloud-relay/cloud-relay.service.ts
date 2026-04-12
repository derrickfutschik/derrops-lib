import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'crypto'
import { Repository } from 'typeorm'
import { CreateCloudRelayConnectionDto } from './dto/create-cloud-relay-connection.dto'
import { CreateCloudRelayConnectionResponseDto } from './dto/create-cloud-relay-connection-response.dto'
import { UpdateCloudRelayConnectionDto } from './dto/update-cloud-relay-connection.dto'
import { CreateCloudRelayJobDto } from './dto/create-cloud-relay-job.dto'
import { CloudRelayConnection } from './entities/cloud-relay-connection.entity'
import { CloudRelayJob } from './entities/cloud-relay-job.entity'
import { RelayQueueService } from './relay-queue.service'

/** TTL for jobs stored in slaops-cloud (10 minutes). */
const JOB_TTL_MS = 10 * 60 * 1000

@Injectable()
export class CloudRelayService {
  constructor(
    @InjectRepository(CloudRelayConnection)
    private readonly connectionRepository: Repository<CloudRelayConnection>,
    @InjectRepository(CloudRelayJob)
    private readonly jobRepository: Repository<CloudRelayJob>,
    private readonly relayQueue: RelayQueueService,
  ) {}

  // ── Connections ────────────────────────────────────────────────────────────

  async findAllConnections(tenantId: string): Promise<CloudRelayConnection[]> {
    return this.connectionRepository.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'ASC' },
    })
  }

  async createConnection(
    dto: CreateCloudRelayConnectionDto,
    tenantId: string,
    userId: string,
  ): Promise<CreateCloudRelayConnectionResponseDto> {
    const type = dto.type ?? 'managed'
    const relayId = randomUUID()

    let sqsQueueUrl: string | null = null
    let sqsRegion: string | null = null
    let sqsQueueMode: 'platform' | 'relay' | null = null
    let deliveryMode = dto.delivery_mode ?? 'direct'
    let url = dto.url ?? ''
    let name = dto.name ?? `relay-${relayId}`

    if (type === 'local-dev') {
      // local-dev always uses platform-queue regardless of requested delivery_mode
      deliveryMode = 'platform-queue'
      sqsQueueMode = dto.sqs_queue_mode ?? 'platform'
      sqsQueueUrl = await this.relayQueue.resolveRelayQueue(
        sqsQueueMode,
        tenantId,
        relayId,
        dto.relay_sqs_queue_url,
      )
      sqsRegion = this.relayQueue.getRegion()
      name = dto.name ?? `local-dev-${relayId}`
      url = dto.url ?? 'http://localhost'
    } else if (deliveryMode === 'platform-queue' || deliveryMode === 'hybrid') {
      // Non-local-dev connections can also use SQS delivery
      sqsQueueMode = dto.sqs_queue_mode ?? 'platform'
      sqsQueueUrl = await this.relayQueue.resolveRelayQueue(
        sqsQueueMode,
        tenantId,
        relayId,
        dto.relay_sqs_queue_url,
      )
      sqsRegion = this.relayQueue.getRegion()
    }

    const connection = this.connectionRepository.create({
      id: relayId,
      tenant_id: tenantId,
      type,
      name,
      url,
      delivery_mode: deliveryMode,
      api_key: randomUUID(),
      sqs_queue_mode: sqsQueueMode,
      sqs_queue_url: sqsQueueUrl,
      sqs_region: sqsRegion,
      aegis_id: dto.aegis_id ?? null,
      iam_user_arn: null,
      iam_access_key_id: null,
    })
    const saved = await this.connectionRepository.save(connection)

    // TODO(stage-2): IAM user + access key provisioning for sqs_queue_mode=platform
    // When implemented, set saved.iam_user_arn and saved.iam_access_key_id, then
    // return iam_access_key_id_created and iam_secret_access_key in the response.

    return Object.assign(new CreateCloudRelayConnectionResponseDto(), saved)
  }

  async updateConnection(
    id: string,
    dto: UpdateCloudRelayConnectionDto,
    tenantId: string,
  ): Promise<CloudRelayConnection> {
    const connection = await this.requireConnection(id, tenantId)
    if (dto.name !== undefined) connection.name = dto.name
    if (dto.url !== undefined) connection.url = dto.url
    if (dto.aegis_id !== undefined) connection.aegis_id = dto.aegis_id
    return this.connectionRepository.save(connection)
  }

  async removeConnection(id: string, tenantId: string): Promise<void> {
    const connection = await this.requireConnection(id, tenantId)

    // Only delete platform-owned queues — relay-owned queues belong to the customer
    if (connection.sqs_queue_url && connection.sqs_queue_mode === 'platform') {
      await this.relayQueue.deleteRelayQueue(connection.sqs_queue_url)
    }

    // TODO(stage-2): delete IAM user when connection.iam_user_arn is set

    await this.connectionRepository.delete({ id, tenant_id: tenantId })
  }

  /** Test HTTP reachability for direct and hybrid connections. */
  async healthCheckConnection(
    id: string,
    tenantId: string,
  ): Promise<{ reachable: boolean; latencyMs?: number; error?: string }> {
    const connection = await this.requireConnection(id, tenantId)

    const start = Date.now()
    try {
      const res = await fetch(`${connection.url}/health`, {
        headers: { Authorization: `Bearer ${connection.api_key}` },
        signal: AbortSignal.timeout(10_000),
      })
      const latencyMs = Date.now() - start
      if (res.ok) return { reachable: true, latencyMs }
      return { reachable: false, error: `HTTP ${res.status}` }
    } catch (err) {
      return { reachable: false, error: (err as Error).message }
    }
  }

  /** Test SQS connectivity by sending a canary message and verifying the send succeeds. */
  async testQueueConnection(id: string, tenantId: string): Promise<{ sent: boolean; error?: string }> {
    const connection = await this.requireConnection(id, tenantId)

    if (!connection.sqs_queue_url) {
      return { sent: false, error: 'No SQS queue configured on this connection' }
    }

    try {
      await this.relayQueue.publishJob(connection.sqs_queue_url, connection.id, {
        id: `canary-${randomUUID()}`,
        request: { _canary: true },
        tenant_id: tenantId,
        user_id: 'health-check',
      })
      return { sent: true }
    } catch (err) {
      return { sent: false, error: (err as Error).message }
    }
  }

  /** Resolve a connection by id+tenant, throwing 404 if not found. */
  private async requireConnection(id: string, tenantId: string): Promise<CloudRelayConnection> {
    const connection = await this.connectionRepository.findOne({ where: { id, tenant_id: tenantId } })
    if (!connection) throw new NotFoundException(`Cloud relay connection ${id} not found`)
    return connection
  }

  // ── Job submission ─────────────────────────────────────────────────────────

  /**
   * Submit a proxy job. The delivery path depends on the connection's delivery_mode:
   *
   *  direct          — call relay synchronously, persist result immediately
   *  relay-queue     — submit to relay's internal queue, relay executes async
   *  platform-queue  — persist request in DB, relay polls and delivers result later
   */
  async enqueueJob(
    dto: CreateCloudRelayJobDto,
    tenantId: string,
    userId: string,
  ): Promise<CloudRelayJob> {
    const connection = await this.connectionRepository.findOne({
      where: { id: dto.connectionId, tenant_id: tenantId },
    })
    if (!connection) {
      throw new NotFoundException(`Cloud relay connection ${dto.connectionId} not found`)
    }

    const expiresAt = new Date(Date.now() + JOB_TTL_MS)
    const base = {
      connection_id: connection.id,
      tenant_id: tenantId,
      user_id: userId,
      delivery_mode: connection.delivery_mode,
      expires_at: expiresAt,
    }

    switch (connection.delivery_mode) {
      case 'direct':
        return this.submitDirect(connection, dto, base)
      case 'relay-queue':
        return this.submitRelayQueue(connection, dto, base)
      case 'platform-queue':
        return this.submitPlatformQueue(connection, dto, base)
      case 'hybrid':
        return this.submitHybrid(connection, dto, base)
    }
  }

  /** direct: call relay proxy synchronously, store result */
  private async submitDirect(
    connection: CloudRelayConnection,
    dto: CreateCloudRelayJobDto,
    base: Partial<CloudRelayJob>,
  ): Promise<CloudRelayJob> {
    let result: object
    try {
      const res = await fetch(`${connection.url}/cloud-relay/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.api_key}`,
        },
        body: JSON.stringify(dto.request),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new ServiceUnavailableException(
          `Relay '${connection.name}' returned ${res.status}: ${text}`,
        )
      }
      result = (await res.json()) as object
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err
      throw new ServiceUnavailableException(
        `Failed to reach relay '${connection.name}': ${(err as Error).message}`,
      )
    }

    const job = this.jobRepository.create({
      ...base,
      status: 'completed',
      request: dto.request as object,
      result,
      completed_at: new Date(),
    })
    return this.jobRepository.save(job)
  }

  /** relay-queue: submit to relay's queue endpoint, relay executes async */
  private async submitRelayQueue(
    connection: CloudRelayConnection,
    dto: CreateCloudRelayJobDto,
    base: Partial<CloudRelayJob>,
  ): Promise<CloudRelayJob> {
    let relayJobId: string
    try {
      const res = await fetch(`${connection.url}/cloud-relay/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.api_key}`,
        },
        body: JSON.stringify({
          request: dto.request,
          tenantId: base.tenant_id,
          userId: base.user_id,
        }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new ServiceUnavailableException(
          `Relay '${connection.name}' returned ${res.status}: ${text}`,
        )
      }
      const body = (await res.json()) as { jobId: string }
      relayJobId = body.jobId
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err
      throw new ServiceUnavailableException(
        `Failed to reach relay '${connection.name}': ${(err as Error).message}`,
      )
    }

    const job = this.jobRepository.create({
      ...base,
      status: 'pending',
      relay_job_id: relayJobId,
    })
    return this.jobRepository.save(job)
  }

  /**
   * platform-queue: persist the job in DB, then publish to the connection's
   * SQS FIFO queue if one exists (local-dev relay). The relay consumes the
   * message via long-poll, executes the proxy request, and posts the result
   * back to POST /cloud-relay/job/:id/result.
   *
   * For platform-queue connections without a dedicated SQS queue (legacy
   * HTTP-polling connections), the job is stored in DB only and the relay
   * polls GET /cloud-relay/queue/next to claim it.
   */
  private async submitPlatformQueue(
    connection: CloudRelayConnection,
    dto: CreateCloudRelayJobDto,
    base: Partial<CloudRelayJob>,
  ): Promise<CloudRelayJob> {
    const job = this.jobRepository.create({
      ...base,
      status: 'pending',
      request: dto.request as object,
    })
    const saved = await this.jobRepository.save(job)

    if (connection.sqs_queue_url) {
      await this.relayQueue.publishJob(connection.sqs_queue_url, connection.id, {
        id: saved.id,
        request: dto.request as object,
        tenant_id: base.tenant_id!,
        user_id: base.user_id!,
      })
    }

    return saved
  }

  /**
   * hybrid: attempt direct HTTP first (5s timeout); if it fails, fall back to
   * platform-queue SQS delivery and return a pending job for async polling.
   */
  private async submitHybrid(
    connection: CloudRelayConnection,
    dto: CreateCloudRelayJobDto,
    base: Partial<CloudRelayJob>,
  ): Promise<CloudRelayJob> {
    try {
      const res = await fetch(`${connection.url}/cloud-relay/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.api_key}`,
        },
        body: JSON.stringify(dto.request),
        signal: AbortSignal.timeout(5_000),
      })
      if (res.ok) {
        const result = (await res.json()) as object
        const job = this.jobRepository.create({
          ...base,
          delivery_mode: 'direct',
          status: 'completed',
          request: dto.request as object,
          result,
          completed_at: new Date(),
        })
        return this.jobRepository.save(job)
      }
    } catch {
      // fall through to SQS path
    }

    // HTTP failed — enqueue via SQS (platform-queue path)
    return this.submitPlatformQueue(connection, dto, { ...base, delivery_mode: 'platform-queue' })
  }

  // ── Job polling (portal → slaops-cloud) ───────────────────────────────────

  async getJob(id: string, tenantId: string): Promise<CloudRelayJob> {
    const job = await this.jobRepository.findOne({ where: { id, tenant_id: tenantId } })
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`)
    }

    // For relay-queue mode the result lives on the relay — sync it on every poll
    if (job.delivery_mode === 'relay-queue' && job.status === 'pending' && job.relay_job_id) {
      const connection = await this.connectionRepository.findOne({
        where: { id: job.connection_id },
      })
      if (connection) {
        await this.syncRelayQueueJob(job, connection)
      }
    }

    return job
  }

  /** Pull current status from the relay and update our DB record. */
  private async syncRelayQueueJob(
    job: CloudRelayJob,
    connection: CloudRelayConnection,
  ): Promise<void> {
    let res: Response
    try {
      res = await fetch(`${connection.url}/cloud-relay/job/${job.relay_job_id}`, {
        headers: { Authorization: `Bearer ${connection.api_key}` },
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      return // best-effort — caller gets stale status
    }

    if (!res.ok) return

    const relayJob = (await res.json()) as { status: string; result?: object; completedAt?: string }

    if (relayJob.status === 'completed' || relayJob.status === 'failed') {
      job.status = relayJob.status === 'completed' ? 'completed' : 'failed'
      job.result = relayJob.result ?? null
      job.completed_at = relayJob.completedAt ? new Date(relayJob.completedAt) : new Date()
      await this.jobRepository.save(job)
    }
  }

  // ── Platform-queue: relay outbound polling endpoints ───────────────────────

  /**
   * Find the connection matching the bearer token.
   * Used to authenticate relay outbound calls in platform-queue mode.
   */
  async findConnectionByApiKey(apiKey: string): Promise<CloudRelayConnection> {
    const connection = await this.connectionRepository.findOne({ where: { api_key: apiKey } })
    if (!connection) {
      throw new UnauthorizedException('Invalid relay API key')
    }
    return connection
  }

  /**
   * Claim the next pending platform-queue job for the given connection.
   * Returns null if there is nothing to process.
   */
  async claimNextJob(connection: CloudRelayConnection): Promise<CloudRelayJob | null> {
    // Use a transaction + FOR UPDATE SKIP LOCKED for safe concurrent claiming
    return this.jobRepository.manager.transaction(async manager => {
      const job = await manager
        .createQueryBuilder(CloudRelayJob, 'job')
        .where('job.connection_id = :connectionId', { connectionId: connection.id })
        .andWhere('job.status = :status', { status: 'pending' })
        .andWhere('job.delivery_mode = :mode', { mode: 'platform-queue' })
        .orderBy('job.created_at', 'ASC')
        .setLock('pessimistic_partial_write')
        .getOne()

      if (!job) return null

      job.status = 'claimed'
      job.claimed_at = new Date()
      return manager.save(job)
    })
  }

  /**
   * Record the result of a platform-queue job (posted back by the relay).
   */
  async completeJob(
    id: string,
    connection: CloudRelayConnection,
    result: object,
    failed: boolean,
  ): Promise<CloudRelayJob> {
    const job = await this.jobRepository.findOne({
      where: { id, connection_id: connection.id },
    })
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`)
    }

    job.status = failed ? 'failed' : 'completed'
    job.result = result
    job.completed_at = new Date()
    return this.jobRepository.save(job)
  }
}
