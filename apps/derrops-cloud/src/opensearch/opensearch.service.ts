import { Injectable, Logger } from '@nestjs/common'
import { Client } from '@opensearch-project/opensearch'
import { config } from '@derrops/config'

import { ALL_INDICES_TEMPLATES } from './resource/indices'
import { ALL_INGEST_PIPELINES } from './resource/pipelines'

const OASPEC_ENTITIES = ['spec', 'server', 'operation', 'param', 'model'] as const
type OaspecEntity = (typeof OASPEC_ENTITIES)[number]

@Injectable()
export class OpenSearchService {
  private readonly logger = new Logger(OpenSearchService.name)

  constructor(private readonly client: Client) {}

  private async upsertTemplates(): Promise<void> {
    this.logger.log('Upserting templates')

    for (const template of ALL_INDICES_TEMPLATES) {
      this.logger.log(`Upserting template: ${template.name}`)
      await this.client.indices
        .putIndexTemplate(template)
        .then(
          (response) =>
            response.statusCode === 200 && this.logger.log('Template upserted successfully'),
        )
    }
  }

  private async upsertPipelines(): Promise<void> {
    this.logger.log('Upserting pipelines')

    for (const pipeline of ALL_INGEST_PIPELINES) {
      this.logger.log(`Upserting pipeline: ${pipeline.id}`)
      await this.client.ingest
        .putPipeline(pipeline)
        .then(
          (response) =>
            response.statusCode === 200 && this.logger.log('Ingest pipeline upserted successfully'),
        )
    }
  }

  async migrateOpenApiSearchResources(): Promise<void> {
    this.logger.log('Migrating OpenSearch indices')

    await this.upsertTemplates()

    await this.upsertPipelines()

    await this.ensureIndexExists()

    await this.ensureGlobalTierIndices()

    // Ensure alias exists pointing at some physical index (optional but recommended)
    // this.logger.log('Ensuring write alias exists')
    // await this.ensureWriteAlias()
  }

  private async ensureIndexExists(): Promise<void> {
    this.logger.log('Ensuring indices exists')
    Object.keys(config)
      .filter((key) => key.startsWith('opensearch.index'))
      .forEach(async (key) => {
        this.logger.log(`Ensuring index exists: ${key} => ${config[key]}`)
        const indexExists = await this.client.indices.exists({ index: config[key] })
        if (!indexExists.body) {
          this.logger.log(`Creating index: ${config[key]}`)
          await this.client.indices.create({
            index: config[key],
          })
        } else {
          this.logger.log(`Index already exists: ${config[key]}`)
        }
      })
  }

  /**
   * Provision 5 search aliases for a tenant pointing at the global tier only.
   * Called on tenant onboarding. Each alias resolves to derrops--t-glbl0000--oaspec--{entity}.
   * Idempotent — skips aliases that already exist.
   */
  async provisionTenantAliases(tenantId: string): Promise<void> {
    const globalTenantId = config['opensearch.oaspec.global-tenant-id']

    const actions = OASPEC_ENTITIES.flatMap((entity) => [
      {
        add: {
          index: config['opensearch.oaspec.index'](globalTenantId, entity),
          alias: config['opensearch.oaspec.search-alias'](tenantId, entity),
          indices_boost: 1.0,
        },
      },
    ])

    await this.client.indices.updateAliases({ body: { actions } })
    this.logger.log(`Provisioned search aliases for tenant ${tenantId} (global tier only)`)
  }

  /**
   * Expand all 5 search aliases for a tenant to include the tenant's private indices.
   * Called lazily on first private spec upload. Idempotent.
   */
  async addPrivateIndicesToAliases(tenantId: string): Promise<void> {
    const globalTenantId = config['opensearch.oaspec.global-tenant-id']
    const tenantBoost = config['opensearch.oaspec.tenant-boost']

    for (const entity of OASPEC_ENTITIES) {
      const privateIndex = config['opensearch.oaspec.index'](tenantId, entity)
      const exists = await this.client.indices.exists({ index: privateIndex })
      if (!exists.body) {
        await this.client.indices.create({ index: privateIndex })
      }
    }

    const actions = OASPEC_ENTITIES.flatMap((entity) => [
      {
        add: {
          index: config['opensearch.oaspec.index'](tenantId, entity),
          alias: config['opensearch.oaspec.search-alias'](tenantId, entity),
          indices_boost: tenantBoost,
        },
      },
      {
        add: {
          index: config['opensearch.oaspec.index'](globalTenantId, entity),
          alias: config['opensearch.oaspec.search-alias'](tenantId, entity),
          indices_boost: 1.0,
        },
      },
    ])

    await this.client.indices.updateAliases({ body: { actions } })
    this.logger.log(`Expanded search aliases for tenant ${tenantId} to include private indices`)
  }

  /**
   * Ensure the global tier indices exist (required before any tenant alias can point at them).
   * Called during opensearch:migrate.
   */
  async ensureGlobalTierIndices(): Promise<void> {
    const globalTenantId = config['opensearch.oaspec.global-tenant-id']

    for (const entity of OASPEC_ENTITIES) {
      const index = config['opensearch.oaspec.index'](globalTenantId, entity)
      const exists = await this.client.indices.exists({ index })
      if (!exists.body) {
        this.logger.log(`Creating global tier index: ${index}`)
        await this.client.indices.create({ index })
      }
    }
  }

  /**
   * Creates a first index if alias doesn't exist (dev-friendly).
   * In mature setups you may handle index creation & alias swaps via explicit migrations.
   */
  private async ensureWriteAlias() {
    const alias = config['opensearch.index.openapi.operations']

    // Check if alias exists
    const aliasExists = await this.client.indices
      .existsAlias({ name: alias })
      .catch(() => ({ body: false as any }))
    const exists = typeof aliasExists.body === 'boolean' ? aliasExists.body : false

    if (exists) {
      this.logger.log(`Alias already exists: ${alias}`)
      return
    }

    // Create initial physical index and attach alias
    const indexName = `openapi-operations-v1`
    const indexExists = await this.client.indices.exists({ index: indexName })
    if (!indexExists.body) {
      this.logger.log(`Creating initial index: ${indexName}`)
      return this.client.indices.create({
        index: indexName,
        body: {
          aliases: {
            [alias]: { is_write_index: true },
          },
        },
      })
    } else {
      // Ensure alias is attached if index exists
      this.logger.log(`Attaching alias ${alias} to existing index ${indexName}`)
      return this.client.indices.updateAliases({
        body: {
          actions: [{ add: { index: indexName, alias, is_write_index: true } }],
        },
      })
    }
  }
}
