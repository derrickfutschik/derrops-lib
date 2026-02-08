import { Injectable, Logger } from '@nestjs/common'
import { Client } from '@opensearch-project/opensearch'
import { config } from '@slaops/config'
import {
  openapiOperationPipeline,
  openapiOperationsTemplate,
} from './resource/openapi.operations.resources'

@Injectable()
export class OpenSearchService {
  private readonly logger = new Logger(OpenSearchService.name)

  constructor(private readonly client: Client) {}

  async migrateOpenApiSearchResources(): Promise<void> {
    this.logger.log('Migrating OpenSearch indices')

    // 1) Upsert template
    this.logger.log('Upserting template')
    await this.client.indices
      .putIndexTemplate(openapiOperationsTemplate)
      .then(
        (response) =>
          response.statusCode === 200 && this.logger.log('Template upserted successfully'),
      )

    // 2) Upsert ingest pipeline
    this.logger.log('Upserting ingest pipeline')
    await this.client.ingest
      .putPipeline(openapiOperationPipeline)
      .then(
        (response) =>
          response.statusCode === 200 && this.logger.log('Ingest pipeline upserted successfully'),
      )

    // 3) Ensure alias exists pointing at some physical index (optional but recommended)
    this.logger.log('Ensuring write alias exists')
    await this.ensureWriteAlias()
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
