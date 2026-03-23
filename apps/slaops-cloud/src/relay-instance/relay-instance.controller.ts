import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CreateRelayInstanceDto } from './dto/create-relay-instance.dto'
import { UpdateRelayInstanceDto } from './dto/update-relay-instance.dto'
import { RelayInstance } from './entities/relay-instance.entity'
import { RelayInstanceService } from './relay-instance.service'

@ApiTags('Relay Instance')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant UUID' })
@Controller('cloud-relay/relay-instance')
export class RelayInstanceController {
  constructor(private readonly relayInstanceService: RelayInstanceService) {}

  @Get()
  @ApiOperation({ summary: 'List all relay instances for the tenant' })
  @ApiResponse({ status: 200, type: [RelayInstance] })
  findAll(@Headers('x-tenant-id') tenantId = 'default'): Promise<RelayInstance[]> {
    return this.relayInstanceService.findAll(tenantId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a relay instance by ID' })
  @ApiParam({ name: 'id', description: 'RelayInstance UUID' })
  @ApiResponse({ status: 200, type: RelayInstance })
  @ApiResponse({ status: 404 })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId = 'default',
  ): Promise<RelayInstance> {
    return this.relayInstanceService.findOne(id, tenantId)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new relay instance' })
  @ApiResponse({ status: 201, type: RelayInstance })
  create(
    @Body() dto: CreateRelayInstanceDto,
    @Headers('x-tenant-id') tenantId = 'default',
  ): Promise<RelayInstance> {
    return this.relayInstanceService.create(dto, tenantId)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a relay instance' })
  @ApiParam({ name: 'id', description: 'RelayInstance UUID' })
  @ApiResponse({ status: 200, type: RelayInstance })
  @ApiResponse({ status: 404 })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRelayInstanceDto,
    @Headers('x-tenant-id') tenantId = 'default',
  ): Promise<RelayInstance> {
    return this.relayInstanceService.update(id, dto, tenantId)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a relay instance' })
  @ApiParam({ name: 'id', description: 'RelayInstance UUID' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404 })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId = 'default',
  ): Promise<void> {
    return this.relayInstanceService.remove(id, tenantId)
  }

  @Post(':id/health-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a health check on the relay instance (mints a platform JWT and calls relay /health)' })
  @ApiParam({ name: 'id', description: 'RelayInstance UUID' })
  @ApiResponse({ status: 200, type: RelayInstance })
  @ApiResponse({ status: 404 })
  healthCheck(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId = 'default',
  ): Promise<RelayInstance> {
    return this.relayInstanceService.healthCheck(id, tenantId)
  }
}
