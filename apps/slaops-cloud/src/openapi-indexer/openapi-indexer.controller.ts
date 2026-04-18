import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { IsString, IsUUID, IsUrl, MaxLength } from 'class-validator'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../user/user.dto'
import { IndexingResponse, OpenApiIndexerService, PresignedUrlResult } from './openapi-indexer.service'

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
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 10)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset (default 0)' })
  @ApiResponse({ status: 200 })
  async searchCatalogue(
    @Query('q') q = '',
    @Query('limit') limit = '10',
    @Query('offset') offset = '0',
  ): Promise<{ total: number; hits: any[] }> {
    return this.indexerService.searchCatalogue(
      q,
      Math.min(parseInt(limit, 10) || 10, 100),
      parseInt(offset, 10) || 0,
    )
  }
}
