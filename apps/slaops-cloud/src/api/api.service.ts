import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as yaml from 'yaml'
import { config } from '@slaops/config'
import { ApiEntity } from './entities/api.entity'
import { OaSpecRef } from './entities/oa-spec-ref'
import { VersionFetchState } from './entities/version-fetch-state'
import { CreateApiDto } from './dto/create-api.dto'
import { UpdateApiDto } from './dto/update-api.dto'
import { AdoptApiDto } from './dto/adopt-api.dto'
import { OpenApiInfoResultDto } from './dto/open-api-info-result.dto'

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
]

@Injectable()
export class ApiService {
  constructor(
    @InjectRepository(ApiEntity)
    private readonly repo: Repository<ApiEntity>,
  ) {}

  async findAll(tenantId: string): Promise<ApiEntity[]> {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    })
  }

  async findOne(id: string, tenantId: string): Promise<ApiEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId } })
    if (!entity) throw new NotFoundException(`API ${id} not found`)
    return entity
  }

  async create(dto: CreateApiDto, tenantId: string): Promise<ApiEntity> {
    const oaSpec = new OaSpecRef()
    const fetch = new VersionFetchState()
    fetch.strategy = dto.versionStrategy ?? 'manual'
    fetch.url = dto.fetchUrl ?? null
    fetch.cron = dto.fetchCron ?? null

    const entity = this.repo.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      externalUrl: dto.externalUrl ?? null,
      managementMode: 'private',
      oaSpec,
      fetch,
    })

    return this.repo.save(entity)
  }

  async update(id: string, dto: UpdateApiDto, tenantId: string): Promise<ApiEntity> {
    const entity = await this.findOne(id, tenantId)

    if (dto.name !== undefined) entity.name = dto.name
    if (dto.description !== undefined) entity.description = dto.description ?? null
    if (dto.externalUrl !== undefined) entity.externalUrl = dto.externalUrl ?? null
    if (dto.versionStrategy !== undefined) entity.fetch.strategy = dto.versionStrategy
    if (dto.fetchUrl !== undefined) entity.fetch.url = dto.fetchUrl ?? null
    if (dto.fetchCron !== undefined) entity.fetch.cron = dto.fetchCron ?? null

    return this.repo.save(entity)
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const entity = await this.findOne(id, tenantId)
    await this.repo.remove(entity)
  }

  async adopt(dto: AdoptApiDto, tenantId: string): Promise<ApiEntity> {
    const oaSpec = new OaSpecRef()
    oaSpec.globalOpensearchId = dto.globalOpensearchId

    const fetch = new VersionFetchState()
    fetch.strategy = null

    const entity = this.repo.create({
      tenantId,
      name: dto.globalOpensearchId,
      managementMode: 'platform',
      oaSpec,
      fetch,
    })

    return this.repo.save(entity)
  }

  async getInfo(rawUrl: string): Promise<OpenApiInfoResultDto> {
    let hostname: string
    try {
      hostname = new URL(rawUrl).hostname
    } catch {
      throw new BadRequestException('Invalid URL')
    }

    if (PRIVATE_HOST_PATTERNS.some((p) => p.test(hostname))) {
      throw new BadRequestException('Private or loopback URLs are not allowed')
    }

    const timeoutMs = config['api.info.fetch.timeout-ms']
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(rawUrl, { signal: controller.signal })
    } catch {
      throw new BadGatewayException('Could not fetch the OpenAPI document from the provided URL')
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      throw new BadGatewayException(`Remote URL returned HTTP ${response.status}`)
    }

    const text = await response.text()

    let parsed: unknown
    try {
      parsed = yaml.parse(text)
    } catch {
      throw new UnprocessableEntityException(
        'Could not parse the OpenAPI document as YAML or JSON',
      )
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('info' in parsed) ||
      !parsed.info ||
      typeof parsed.info !== 'object'
    ) {
      throw new UnprocessableEntityException('No valid info block found in the OpenAPI document')
    }

    const info = parsed.info as Record<string, unknown>

    if (typeof info['title'] !== 'string') {
      throw new UnprocessableEntityException('The info.title field is missing or not a string')
    }

    return {
      title: info['title'],
      description: typeof info['description'] === 'string' ? info['description'] : undefined,
      version: typeof info['version'] === 'string' ? info['version'] : undefined,
      rawContent: text,
    }
  }

  /** Update the OASpec stats on an api row after a successful indexing run. */
  async updateOaSpecStats(
    id: string,
    tenantId: string,
    stats: Partial<OaSpecRef>,
  ): Promise<ApiEntity> {
    const entity = await this.findOne(id, tenantId)
    Object.assign(entity.oaSpec, stats)
    return this.repo.save(entity)
  }
}
