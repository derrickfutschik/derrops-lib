import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { VendorJwtService } from '../vendor-jwt/vendor-jwt.service'
import { CreateRelayInstanceDto } from './dto/create-relay-instance.dto'
import { UpdateRelayInstanceDto } from './dto/update-relay-instance.dto'
import { RelayInstance } from './entities/relay-instance.entity'

/** Timeout for relay health-check HTTP requests (milliseconds). */
const RELAY_HEALTH_CHECK_TIMEOUT_MS = 10_000

@Injectable()
export class RelayInstanceService {
  private readonly logger = new Logger(RelayInstanceService.name)

  constructor(
    @InjectRepository(RelayInstance)
    private readonly repo: Repository<RelayInstance>,
    private readonly vendorJwt: VendorJwtService,
  ) {}

  findAll(tenantId: string): Promise<RelayInstance[]> {
    return this.repo.find({ where: { tenant_id: tenantId } })
  }

  async findOne(id: string, tenantId: string): Promise<RelayInstance> {
    const instance = await this.repo.findOne({ where: { id, tenant_id: tenantId } })
    if (!instance) throw new NotFoundException(`RelayInstance ${id} not found`)
    return instance
  }

  async create(dto: CreateRelayInstanceDto, tenantId: string): Promise<RelayInstance> {
    const instance = this.repo.create({
      tenant_id: tenantId,
      name: dto.name,
      url: dto.url,
      aegis_id: null,
      status: 'pending',
      last_seen_at: null,
    })
    return this.repo.save(instance)
  }

  async update(id: string, dto: UpdateRelayInstanceDto, tenantId: string): Promise<RelayInstance> {
    const instance = await this.findOne(id, tenantId)
    if (dto.name !== undefined) instance.name = dto.name
    if (dto.url !== undefined) instance.url = dto.url
    if (dto.aegisId !== undefined) instance.aegis_id = dto.aegisId
    return this.repo.save(instance)
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const instance = await this.findOne(id, tenantId)
    await this.repo.remove(instance)
  }

  async healthCheck(id: string, tenantId: string): Promise<RelayInstance> {
    const instance = await this.findOne(id, tenantId)

    let jwt: string
    try {
      jwt = await this.vendorJwt.mintRelayJwt(instance.id)
    } catch (err) {
      this.logger.error(`Failed to mint JWT for relay ${id}: ${(err as Error).message}`)
      instance.status = 'unreachable'
      return this.repo.save(instance)
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), RELAY_HEALTH_CHECK_TIMEOUT_MS)

      const response = await fetch(`${instance.url}/health`, {
        method: 'GET',
        headers: { authorization: `Bearer ${jwt}` },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      if (response.ok) {
        instance.status = 'active'
        instance.last_seen_at = new Date()
      } else {
        this.logger.warn(`Relay ${id} health check returned HTTP ${response.status}`)
        instance.status = 'unreachable'
      }
    } catch (err) {
      this.logger.warn(`Relay ${id} health check failed: ${(err as Error).message}`)
      instance.status = 'unreachable'
    }

    return this.repo.save(instance)
  }
}
