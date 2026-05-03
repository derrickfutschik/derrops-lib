import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { OpenApiIndexDocument } from '@derrops/cloud/openapi-search/types/openapi-index.types'

/**
 * A single search hit with score and highlights
 */
export class OpenApiSearchHit {
  @ApiProperty({ description: 'The matched document' })
  document: OpenApiIndexDocument

  @ApiProperty({ description: 'Search relevance score' })
  score: number

  @ApiPropertyOptional({ description: 'Highlighted matches' })
  highlights?: Record<string, string[]>
}

/**
 * Aggregation bucket for facets
 */
export class AggregationBucket {
  @ApiProperty({ description: 'Aggregation key' })
  key: string

  @ApiProperty({ description: 'Document count' })
  count: number
}

/**
 * Aggregations/facets in search response
 */
export class SearchAggregations {
  @ApiProperty({ description: 'Provider aggregations', type: [AggregationBucket] })
  providers: AggregationBucket[]

  @ApiProperty({ description: 'Tag aggregations', type: [AggregationBucket] })
  tags: AggregationBucket[]

  @ApiProperty({ description: 'HTTP method aggregations', type: [AggregationBucket] })
  methods: AggregationBucket[]

  @ApiProperty({ description: 'Path prefix aggregations', type: [AggregationBucket] })
  pathPrefixes: AggregationBucket[]
}

/**
 * Search response DTO
 */
export class OpenApiSearchResponseDto {
  @ApiProperty({ description: 'Total matching documents' })
  total: number

  @ApiProperty({ description: 'Search hits', type: [OpenApiSearchHit] })
  hits: OpenApiSearchHit[]

  @ApiPropertyOptional({ description: 'Aggregations/facets' })
  aggregations?: SearchAggregations

  @ApiProperty({ description: 'Query execution time in milliseconds' })
  took: number
}

/**
 * Provider list response
 */
export class ProviderListResponseDto {
  @ApiProperty({ description: 'Provider name' })
  provider: string

  @ApiProperty({ description: 'Number of API specs' })
  count: number
}

/**
 * Index statistics response
 */
export class IndexStatsResponseDto {
  @ApiProperty({ description: 'Total indexed documents' })
  totalDocuments: number

  @ApiProperty({ description: 'Total operations across all specs' })
  totalOperations: number

  @ApiProperty({ description: 'Number of unique providers' })
  uniqueProviders: number

  @ApiProperty({ description: 'Number of unique tags' })
  uniqueTags: number

  @ApiPropertyOptional({ description: 'Last indexed timestamp' })
  lastIndexedAt?: string
}
