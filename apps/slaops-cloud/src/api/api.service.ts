import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ApiEntity } from './entities/api.entity'
import { OaSpecRef } from './entities/oa-spec-ref'
import { VersionFetchState } from './entities/version-fetch-state'
import { CreateApiDto } from './dto/create-api.dto'
import { UpdateApiDto } from './dto/update-api.dto'
import { AdoptApiDto } from './dto/adopt-api.dto'

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
