import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Client } from '@opensearch-project/opensearch'
import { config } from '@slaops/config'
import { Repository } from 'typeorm'
import { ApiEntity } from './entities/api.entity'


/**
 * Nightly job that refreshes cached OASpec stats on platform-managed api rows
 * by reading the corresponding global spec document from OpenSearch.
 *
 * Scheduled at 03:00 UTC. Requires @nestjs/schedule (ScheduleModule.forRoot()).
 * Currently wired as an injectable service — attach @Cron when @nestjs/schedule is added.
 */
@Injectable()
export class PlatformStatsSyncScheduler {
  private readonly logger = new Logger(PlatformStatsSyncScheduler.name)

  constructor(
    @InjectRepository(ApiEntity)
    private readonly repo: Repository<ApiEntity>,
    private readonly opensearchClient: Client,
  ) {}

  async syncPlatformManagedStats(): Promise<void> {
    const globalTenantId = config['opensearch.oaspec.global-tenant-id']
    const specIndex = config['opensearch.oaspec.index'](globalTenantId, 'spec')

    const platformApis = await this.repo.find({
      where: { managementMode: 'platform' },
    })

    this.logger.log(`Syncing stats for ${platformApis.length} platform-managed APIs`)

    for (const api of platformApis) {
      const globalOpensearchId = api.oaSpec.globalOpensearchId
      if (!globalOpensearchId) continue

      try {
        const response = await this.opensearchClient.get({
          index: specIndex,
          id: globalOpensearchId,
        })

        if (!response.body.found) {
          this.logger.warn(
            `Global spec doc ${globalOpensearchId} not found for API ${api.id} — skipping (api row preserved)`,
          )
          continue
        }

        const src = response.body._source
        api.oaSpec.latestVersion = src.version ?? null
        api.oaSpec.operationCount = src.operationCount ?? null
        api.oaSpec.serverCount = src.serverCount ?? null
        api.oaSpec.parameterCount = src.parameterCount ?? null
        api.oaSpec.modelCount = src.modelCount ?? null
        api.oaSpec.lastIndexedAt = src.indexedAt ? new Date(src.indexedAt) : null

        await this.repo.save(api)
      } catch (err: any) {
        this.logger.error(`Failed to sync stats for API ${api.id}: ${err.message}`)
      }
    }
  }
}
