import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash, randomUUID } from 'crypto'
import { Repository } from 'typeorm'
import { AegisRegisterDto } from './dto/aegis-register.dto'
import { CreateAegisInstanceDto } from './dto/create-aegis-instance.dto'
import { UpdateAegisInstanceDto } from './dto/update-aegis-instance.dto'
import { AegisInstance } from './entities/aegis-instance.entity'

/** Timeout for Aegis health-check HTTP requests (milliseconds). */
const AEGIS_HEALTH_CHECK_TIMEOUT_MS = 10_000

/** Minimum number of keys a JWKS endpoint must return to be considered healthy. */
const AEGIS_JWKS_MIN_KEY_COUNT = 1

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface AegisCreateResponse {
  id: string
  tenant_id: string
  name: string
  url: string
  jwks_url: string
  status: string
  created_at: Date
  updated_at: Date
  /** One-time registration token — only returned on create, never stored in plaintext. */
  registrationToken: string
}

@Injectable()
export class AegisInstanceService {
  private readonly logger = new Logger(AegisInstanceService.name)

  constructor(
    @InjectRepository(AegisInstance)
    private readonly repo: Repository<AegisInstance>,
  ) {}

  findAll(tenantId: string): Promise<AegisInstance[]> {
    return this.repo.find({ where: { tenant_id: tenantId } })
  }

  async findOne(id: string, tenantId: string): Promise<AegisInstance> {
    const instance = await this.repo.findOne({ where: { id, tenant_id: tenantId } })
    if (!instance) throw new NotFoundException(`AegisInstance ${id} not found`)
    return instance
  }

  async create(dto: CreateAegisInstanceDto, tenantId: string): Promise<AegisCreateResponse> {
    const registrationToken = randomUUID()
    const instance = this.repo.create({
      tenant_id: tenantId,
      name: dto.name,
      url: dto.url,
      jwks_url: dto.jwksUrl,
      registration_token_hash: hashToken(registrationToken),
      status: 'pending',
      last_seen_at: null,
    })
    const saved = await this.repo.save(instance)
    return {
      id: saved.id,
      tenant_id: saved.tenant_id,
      name: saved.name,
      url: saved.url,
      jwks_url: saved.jwks_url,
      status: saved.status,
      created_at: saved.created_at,
      updated_at: saved.updated_at,
      registrationToken,
    }
  }

  async update(id: string, dto: UpdateAegisInstanceDto, tenantId: string): Promise<AegisInstance> {
    const instance = await this.findOne(id, tenantId)
    if (dto.name !== undefined) instance.name = dto.name
    if (dto.url !== undefined) instance.url = dto.url
    if (dto.jwksUrl !== undefined) instance.jwks_url = dto.jwksUrl
    return this.repo.save(instance)
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const instance = await this.findOne(id, tenantId)
    await this.repo.remove(instance)
  }

  async healthCheck(id: string, tenantId: string): Promise<AegisInstance> {
    const instance = await this.findOne(id, tenantId)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), AEGIS_HEALTH_CHECK_TIMEOUT_MS)

      const response = await fetch(instance.jwks_url, {
        method: 'GET',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      if (!response.ok) {
        this.logger.warn(`Aegis ${id} JWKS endpoint returned HTTP ${response.status}`)
        instance.status = 'unreachable'
        return this.repo.save(instance)
      }

      const body = (await response.json()) as { keys?: unknown[] }
      const keyCount = Array.isArray(body?.keys) ? body.keys.length : 0

      if (keyCount >= AEGIS_JWKS_MIN_KEY_COUNT) {
        instance.status = 'active'
        instance.last_seen_at = new Date()
      } else {
        this.logger.warn(
          `Aegis ${id} JWKS returned ${keyCount} keys (minimum required: ${AEGIS_JWKS_MIN_KEY_COUNT})`,
        )
        instance.status = 'unreachable'
      }
    } catch (err) {
      this.logger.warn(`Aegis ${id} health check failed: ${(err as Error).message}`)
      instance.status = 'unreachable'
    }

    return this.repo.save(instance)
  }

  async register(dto: AegisRegisterDto): Promise<AegisInstance> {
    const tokenHash = hashToken(dto.registrationToken)
    const instance = await this.repo.findOne({
      where: { registration_token_hash: tokenHash, status: 'pending' },
    })

    if (!instance) {
      throw new BadRequestException('Invalid or already-used registration token')
    }

    instance.status = 'active'
    instance.registration_token_hash = null
    instance.jwks_url = dto.jwksUrl
    instance.last_seen_at = new Date()

    return this.repo.save(instance)
  }
}
