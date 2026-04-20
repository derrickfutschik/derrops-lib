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
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../user/user.dto'
import { CreateRelayInstanceDto } from './dto/create-relay-instance.dto'
import { UpdateRelayInstanceDto } from './dto/update-relay-instance.dto'
import { RelayInstance } from './entities/relay-instance.entity'
import { RelayInstanceService } from './relay-instance.service'

@ApiTags('Relay Instance')
@Controller('cloud-relay/relay-instance')
export class RelayInstanceController {
  constructor(private readonly relayInstanceService: RelayInstanceService) {}

  @Get()
  @ApiOperation({ summary: 'List all relay instances for the tenant' })
  @ApiResponse({ status: 200, type: [RelayInstance] })
  findAll(@CurrentUser() user: User): Promise<RelayInstance[]> {
    return this.relayInstanceService.findAll(user['custom:tenant_id'])
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a relay instance by ID' })
  @ApiParam({ name: 'id', description: 'RelayInstance UUID' })
  @ApiResponse({ status: 200, type: RelayInstance })
  @ApiResponse({ status: 404 })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<RelayInstance> {
    return this.relayInstanceService.findOne(id, user['custom:tenant_id'])
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new relay instance' })
  @ApiResponse({ status: 201, type: RelayInstance })
  create(@Body() dto: CreateRelayInstanceDto, @CurrentUser() user: User): Promise<RelayInstance> {
    return this.relayInstanceService.create(dto, user['custom:tenant_id'])
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a relay instance' })
  @ApiParam({ name: 'id', description: 'RelayInstance UUID' })
  @ApiResponse({ status: 200, type: RelayInstance })
  @ApiResponse({ status: 404 })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRelayInstanceDto,
    @CurrentUser() user: User,
  ): Promise<RelayInstance> {
    return this.relayInstanceService.update(id, dto, user['custom:tenant_id'])
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a relay instance' })
  @ApiParam({ name: 'id', description: 'RelayInstance UUID' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404 })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User): Promise<void> {
    return this.relayInstanceService.remove(id, user['custom:tenant_id'])
  }

  @Post(':id/health-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Trigger a health check on the relay instance (mints a platform JWT and calls relay /health)',
  })
  @ApiParam({ name: 'id', description: 'RelayInstance UUID' })
  @ApiResponse({ status: 200, type: RelayInstance })
  @ApiResponse({ status: 404 })
  healthCheck(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<RelayInstance> {
    return this.relayInstanceService.healthCheck(id, user['custom:tenant_id'])
  }
}
