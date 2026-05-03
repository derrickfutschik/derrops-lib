import { ApiPropertyOptional } from '@nestjs/swagger'
import { Column } from 'typeorm'

export class OaSpecRef {
  @ApiPropertyOptional({ description: 'S3 bucket where the raw spec is stored' })
  @Column({ name: 'spec_bucket', type: 'varchar', length: 255, nullable: true })
  bucket: string | null = null

  @ApiPropertyOptional({
    description: 'S3 object key — {tenantId}/APIs/{provider}/{service}/{version}/openapi.yaml',
  })
  @Column({ name: 'spec_key', type: 'text', nullable: true })
  key: string | null = null

  @ApiPropertyOptional({ description: 'Latest indexed spec version string (e.g. "3.1.0")' })
  @Column({ name: 'spec_latest_version', type: 'varchar', length: 100, nullable: true })
  latestVersion: string | null = null

  @ApiPropertyOptional({
    description: 'OpenSearch document ID of the latest spec in the global catalogue index',
  })
  @Column({ name: 'spec_global_opensearch_id', type: 'varchar', length: 64, nullable: true })
  globalOpensearchId: string | null = null

  @ApiPropertyOptional({ description: 'Number of operations in the latest indexed spec' })
  @Column({ name: 'spec_operation_count', type: 'integer', nullable: true })
  operationCount: number | null = null

  @ApiPropertyOptional({ description: 'Number of servers in the latest indexed spec' })
  @Column({ name: 'spec_server_count', type: 'integer', nullable: true })
  serverCount: number | null = null

  @ApiPropertyOptional({ description: 'Number of unique parameters in the latest indexed spec' })
  @Column({ name: 'spec_parameter_count', type: 'integer', nullable: true })
  parameterCount: number | null = null

  @ApiPropertyOptional({ description: 'Number of schema models in the latest indexed spec' })
  @Column({ name: 'spec_model_count', type: 'integer', nullable: true })
  modelCount: number | null = null

  @ApiPropertyOptional({ description: 'Timestamp of the last successful indexing run' })
  @Column({ name: 'spec_last_indexed_at', type: 'timestamp', nullable: true })
  lastIndexedAt: Date | null = null
}
