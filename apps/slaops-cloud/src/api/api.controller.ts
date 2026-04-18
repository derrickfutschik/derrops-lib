import {
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
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../user/user.dto'
import { ApiService } from './api.service'
import { AdoptApiDto } from './dto/adopt-api.dto'
import { CreateApiDto } from './dto/create-api.dto'
import { UpdateApiDto } from './dto/update-api.dto'
import { ApiEntity } from './entities/api.entity'

@ApiTags('API')
@ApiBearerAuth()
@Controller('apis')
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

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
