import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { OpenApiIndexDocument } from '@derrops/cloud/openapi-search/types/openapi-index.types'
import { OpenApiSearchQueryDto } from './dto/openapi-search-query.dto'
import {
  IndexStatsResponseDto,
  OpenApiSearchResponseDto,
  ProviderListResponseDto,
} from './dto/openapi-search-response.dto'
import { OpenApiSearchService } from './openapi-search.service'

@ApiTags('OpenAPI Search')
@Controller('openapi-search')
export class OpenApiSearchController {
  constructor(private readonly searchService: OpenApiSearchService) {}

  /**
   * Search indexed OpenAPI specifications
   */
  @Get()
  @ApiOperation({
    summary: 'Search OpenAPI specifications',
    description:
      'Search indexed OpenAPI specs by title, description, operations, tags, and more. Supports full-text search and filtering.',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: OpenApiSearchResponseDto,
  })
  async search(@Query() query: OpenApiSearchQueryDto): Promise<OpenApiSearchResponseDto> {
    return this.searchService.search(query)
  }

  /**
   * List all providers with spec counts
   */
  @Get('provider')
  @ApiOperation({
    summary: 'List all API providers',
    description:
      'Returns a list of all unique providers/domains with the count of API specs for each.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of providers',
    type: [ProviderListResponseDto],
  })
  async listProviders(): Promise<ProviderListResponseDto[]> {
    return this.searchService.listProviders()
  }

  /**
   * Get aggregated statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get index statistics',
    description: 'Returns aggregate statistics about the indexed OpenAPI specifications.',
  })
  @ApiResponse({
    status: 200,
    description: 'Index statistics',
    type: IndexStatsResponseDto,
  })
  async getStats(): Promise<IndexStatsResponseDto> {
    return this.searchService.getStats()
  }

  /**
   * Get a specific OpenAPI spec by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get OpenAPI spec by ID',
    description:
      'Retrieve a specific OpenAPI specification by its ID (format: provider/service/version).',
  })
  @ApiParam({
    name: 'id',
    description: 'OpenAPI spec ID (URL-encoded, e.g., github.com%2Fapi.github.com%2F1.1.4)',
    example: 'github.com/api.github.com/1.1.4',
  })
  @ApiResponse({
    status: 200,
    description: 'OpenAPI specification document',
  })
  @ApiResponse({
    status: 404,
    description: 'OpenAPI spec not found',
  })
  async getById(@Param('id') id: string): Promise<OpenApiIndexDocument> {
    // Decode the ID in case it was URL-encoded
    const decodedId = decodeURIComponent(id)
    const document = await this.searchService.getById(decodedId)

    if (!document) {
      throw new NotFoundException(`OpenAPI spec with ID '${decodedId}' not found`)
    }

    return document
  }
}
