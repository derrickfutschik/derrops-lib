/**
 * OpenAPI Indexer Controller — upload, index, catalogue, and tab view endpoints.
 *
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/views/index.md
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/indexing-pipeline.md
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { IsString, IsUUID, MaxLength } from 'class-validator'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../user/user.dto'
import {
  IndexingResponse,
  OpenApiIndexerService,
  PagedResult,
  PresignedUrlResult,
  VersionHit,
} from './openapi-indexer.service'
import {
  CatalogueHit,
  OaModelDocument,
  OaOperationDocument,
  OaParamDocument,
  OaServerDocument,
} from './oaspec-documents'
import { config } from '@slaops/config'

class UploadUrlDto {
  @IsUUID()
  apiId!: string

  @IsString()
  @MaxLength(500)
  key!: string
}

class IndexFromS3Dto {
  @IsUUID()
  apiId!: string

  @IsString()
  bucket!: string

  @IsString()
  key!: string
}

const DEFAULT_PAGE_SIZE = config['app.pagination.default.size']
const MAX_PAGE_SIZE = 100

function parseFrom(raw: string | undefined): number {
  return Math.max(0, parseInt(raw ?? '0', 10) || 0)
}

function parseSize(raw: string | undefined): number {
  return Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(raw ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  )
}

function parseOrder(raw: string | undefined): 'asc' | 'desc' {
  return raw === 'asc' ? 'asc' : 'desc'
}

@ApiTags('OpenAPI Indexer')
@ApiBearerAuth()
@Controller('openapi')
export class OpenApiIndexerController {
  constructor(private readonly indexerService: OpenApiIndexerService) {}

  /**
   * Generate a pre-signed PUT URL for uploading an OASpec directly to the OASpec storage bucket.
   * Body: { apiId, key }
   */
  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a pre-signed PUT URL for uploading a spec to the OASpec bucket' })
  @ApiResponse({ status: 200 })
  async getUploadUrl(
    @Body() body: UploadUrlDto,
    @CurrentUser() _user: User,
  ): Promise<PresignedUrlResult> {
    if (!body?.apiId || !body?.key) {
      throw new BadRequestException('Missing required fields: apiId, key')
    }
    return this.indexerService.generatePresignedUploadUrl(body.apiId, body.key)
  }

  /**
   * Trigger the 6-step indexing pipeline for a spec already in S3.
   * Body: { apiId, bucket, key }
   */
  @Post('index')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Index a spec from S3 — runs the 6-step OASpec pipeline' })
  @ApiResponse({ status: 200 })
  async indexFromS3(
    @Body() body: IndexFromS3Dto,
    @CurrentUser() user: User,
  ): Promise<IndexingResponse> {
    if (!body?.apiId || !body?.bucket || !body?.key) {
      throw new BadRequestException('Missing required fields: apiId, bucket, key')
    }
    return this.indexerService.indexSpec(
      body.apiId,
      user['custom:tenant_id'],
      body.bucket,
      body.key,
    )
  }

  /**
   * Search the SLAOps-managed platform catalogue (global tier, unauthenticated-friendly).
   * Returns spec summaries from the t-glbl0000 index.
   */
  @Get('catalogue')
  @ApiOperation({ summary: 'Search the platform-managed API catalogue' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results (default 10)',
  })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset (default 0)' })
  @ApiResponse({ status: 200 })
  async searchCatalogue(
    @Query('q') q = '',
    @Query('limit') limit = '10',
    @Query('offset') offset = '0',
  ): Promise<{ total: number; hits: CatalogueHit[] }> {
    return this.indexerService.searchCatalogue(
      q,
      Math.min(parseInt(limit, 10) || 10, 100),
      parseInt(offset, 10) || 0,
    )
  }

  // ---------------------------------------------------------------------------
  // API detail tab view endpoints
  // ---------------------------------------------------------------------------

  @Get('api/:apiId/versions')
  @ApiOperation({ summary: 'Paginated spec version history for an API' })
  @ApiParam({ name: 'apiId', description: 'API UUID' })
  @ApiQuery({ name: 'from', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200 })
  async getVersions(
    @Param('apiId') apiId: string,
    @Query('from') from?: string,
    @Query('size') size?: string,
    @Query('sort') sort = 'indexedAt',
    @Query('order') order?: string,
    @CurrentUser() user?: User,
  ): Promise<PagedResult<VersionHit>> {
    return this.indexerService.queryVersions(
      apiId,
      user!['custom:tenant_id'],
      parseFrom(from),
      parseSize(size),
      sort,
      parseOrder(order),
    )
  }

  @Get('api/:apiId/operations')
  @ApiOperation({ summary: 'Paginated operations for an API version' })
  @ApiParam({ name: 'apiId', description: 'API UUID' })
  @ApiQuery({
    name: 'version',
    required: false,
    description: 'Specific version or "latest" (default)',
  })
  @ApiQuery({ name: 'from', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search' })
  @ApiQuery({ name: 'method', required: false, description: 'Comma-separated HTTP method filter' })
  @ApiQuery({ name: 'tag', required: false, description: 'Tag filter' })
  @ApiResponse({ status: 200 })
  async getOperations(
    @Param('apiId') apiId: string,
    @Query('version') version = 'latest',
    @Query('from') from?: string,
    @Query('size') size?: string,
    @Query('sort') sort = 'path',
    @Query('order') order?: string,
    @Query('q') q?: string,
    @Query('method') method?: string,
    @Query('tag') tag?: string,
    @CurrentUser() user?: User,
  ): Promise<PagedResult<OaOperationDocument>> {
    return this.indexerService.queryOperations(
      apiId,
      user!['custom:tenant_id'],
      version,
      parseFrom(from),
      parseSize(size),
      sort,
      parseOrder(order),
      q,
      method,
      tag,
    )
  }

  @Get('api/:apiId/servers')
  @ApiOperation({ summary: 'Paginated servers for an API version' })
  @ApiParam({ name: 'apiId', description: 'API UUID' })
  @ApiQuery({ name: 'version', required: false })
  @ApiQuery({ name: 'from', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200 })
  async getServers(
    @Param('apiId') apiId: string,
    @Query('version') version = 'latest',
    @Query('from') from?: string,
    @Query('size') size?: string,
    @Query('sort') sort = 'serverIndex',
    @Query('order') order?: string,
    @CurrentUser() user?: User,
  ): Promise<PagedResult<OaServerDocument>> {
    return this.indexerService.queryServers(
      apiId,
      user!['custom:tenant_id'],
      version,
      parseFrom(from),
      parseSize(size),
      sort,
      parseOrder(order),
    )
  }

  @Get('api/:apiId/parameters')
  @ApiOperation({ summary: 'Paginated parameters for an API version' })
  @ApiParam({ name: 'apiId', description: 'API UUID' })
  @ApiQuery({ name: 'version', required: false })
  @ApiQuery({ name: 'from', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'location', required: false, description: 'path | query | header | cookie' })
  @ApiQuery({ name: 'operationId', required: false })
  @ApiResponse({ status: 200 })
  async getParameters(
    @Param('apiId') apiId: string,
    @Query('version') version = 'latest',
    @Query('from') from?: string,
    @Query('size') size?: string,
    @Query('sort') sort = 'name',
    @Query('order') order?: string,
    @Query('q') q?: string,
    @Query('location') location?: string,
    @Query('operationId') operationId?: string,
    @CurrentUser() user?: User,
  ): Promise<PagedResult<OaParamDocument>> {
    return this.indexerService.queryParameters(
      apiId,
      user!['custom:tenant_id'],
      version,
      parseFrom(from),
      parseSize(size),
      sort,
      parseOrder(order),
      q,
      location,
      operationId,
    )
  }

  @Get('api/:apiId/models')
  @ApiOperation({ summary: 'Paginated models for an API version' })
  @ApiParam({ name: 'apiId', description: 'API UUID' })
  @ApiQuery({ name: 'version', required: false })
  @ApiQuery({ name: 'from', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'usedIn', required: false, description: 'request | response' })
  @ApiQuery({ name: 'operationId', required: false })
  @ApiResponse({ status: 200 })
  async getModels(
    @Param('apiId') apiId: string,
    @Query('version') version = 'latest',
    @Query('from') from?: string,
    @Query('size') size?: string,
    @Query('sort') sort = 'name',
    @Query('order') order?: string,
    @Query('q') q?: string,
    @Query('usedIn') usedIn?: string,
    @Query('operationId') operationId?: string,
    @CurrentUser() user?: User,
  ): Promise<PagedResult<OaModelDocument>> {
    return this.indexerService.queryModels(
      apiId,
      user!['custom:tenant_id'],
      version,
      parseFrom(from),
      parseSize(size),
      sort,
      parseOrder(order),
      q,
      usedIn,
      operationId,
    )
  }
}
