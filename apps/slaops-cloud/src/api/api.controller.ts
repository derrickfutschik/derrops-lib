import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../user/user.dto'
import { ApiService } from './api.service'
import { AdoptApiDto } from './dto/adopt-api.dto'
import { CreateApiDto } from './dto/create-api.dto'
import { OpenApiInfoResultDto } from './dto/open-api-info-result.dto'
import { UpdateApiDto } from './dto/update-api.dto'
import { ApiEntity } from './entities/api.entity'

@ApiTags('API')
@ApiBearerAuth()
@Controller('apis')
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get('info')
  @ApiOperation({
    summary: 'Fetch the info block from a remote OpenAPI document',
    description:
      'Downloads the YAML/JSON at openapi_doc_url (server-side, bypassing browser CORS restrictions) ' +
      'and returns the info.title, info.description, and info.version fields.',
  })
  @ApiQuery({ name: 'openapi_doc_url', required: true, description: 'URL of the remote OpenAPI document' })
  @ApiResponse({ status: 200, type: OpenApiInfoResultDto })
  @ApiResponse({ status: 400, description: 'Missing or invalid URL, or private/loopback address' })
  @ApiResponse({ status: 422, description: 'Could not parse the document or extract the info block' })
  @ApiResponse({ status: 502, description: 'Remote URL could not be reached' })
  getInfo(@Query('openapi_doc_url') url: string): Promise<OpenApiInfoResultDto> {
    if (!url) throw new BadRequestException('openapi_doc_url is required')
    return this.apiService.getInfo(url)
  }

  @Get()
  @ApiOperation({ summary: "List the tenant's APIs" })
  @ApiResponse({ status: 200, type: [ApiEntity] })
  findAll(@CurrentUser() user: User): Promise<ApiEntity[]> {
    return this.apiService.findAll(user['custom:tenant_id'])
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single API' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: ApiEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User): Promise<ApiEntity> {
    return this.apiService.findOne(id, user['custom:tenant_id'])
  }

  @Post()
  @ApiOperation({ summary: 'Create a new API' })
  @ApiResponse({ status: 201, type: ApiEntity })
  create(@Body() dto: CreateApiDto, @CurrentUser() user: User): Promise<ApiEntity> {
    return this.apiService.create(dto, user['custom:tenant_id'])
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an API (name, description, externalUrl, fetch strategy)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: ApiEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApiDto,
    @CurrentUser() user: User,
  ): Promise<ApiEntity> {
    return this.apiService.update(id, dto, user['custom:tenant_id'])
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an API' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204 })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.apiService.remove(id, user['custom:tenant_id'])
  }

  @Post('adopt')
  @ApiOperation({
    summary: 'Adopt a platform-managed API from the global catalogue',
    description:
      'Creates an api row with management_mode=platform pointing to the specified global catalogue document. ' +
      'No private index is provisioned — the tenant reads from the platform-managed global tier.',
  })
  @ApiResponse({ status: 201, type: ApiEntity })
  adopt(@Body() dto: AdoptApiDto, @CurrentUser() user: User): Promise<ApiEntity> {
    return this.apiService.adopt(dto, user['custom:tenant_id'])
  }
}
