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
import { ApiOperation, ApiParam, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../user/user.dto'
import { AegisCreateResponse, AegisInstanceService } from './aegis-instance.service'
import { CreateAegisInstanceDto } from './dto/create-aegis-instance.dto'
import { UpdateAegisInstanceDto } from './dto/update-aegis-instance.dto'
import { AegisInstance } from './entities/aegis-instance.entity'

/** Response shape for Aegis instance creation — includes the one-time registration token. */
class AegisCreateResponseDto {
  @ApiProperty() id: string
  @ApiProperty() tenant_id: string
  @ApiProperty() name: string
  @ApiProperty() url: string
  @ApiProperty() jwks_url: string
  @ApiProperty() status: string
  @ApiProperty() created_at: Date
  @ApiProperty() updated_at: Date
  @ApiProperty({
    description:
      'One-time registration token — configure Aegis with this value. Not stored in plaintext.',
  })
  registrationToken: string
}

@ApiTags('Aegis Instance')
@Controller('cloud-relay/aegis-instance')
export class AegisInstanceController {
  constructor(private readonly aegisInstanceService: AegisInstanceService) {}

  @Get()
  @ApiOperation({ summary: 'List all Aegis instances for the tenant' })
  @ApiResponse({ status: 200, type: [AegisInstance] })
  findAll(@CurrentUser() user: User): Promise<AegisInstance[]> {
    return this.aegisInstanceService.findAll(user['custom:tenant_id'])
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an Aegis instance by ID' })
  @ApiParam({ name: 'id', description: 'AegisInstance UUID' })
  @ApiResponse({ status: 200, type: AegisInstance })
  @ApiResponse({ status: 404 })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<AegisInstance> {
    return this.aegisInstanceService.findOne(id, user['custom:tenant_id'])
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new Aegis instance',
    description:
      'Returns a one-time `registrationToken`. Configure Aegis with this token so it can ' +
      'complete the registration handshake via POST /cloud-relay/aegis/register.',
  })
  @ApiResponse({ status: 201, type: AegisCreateResponseDto })
  create(
    @Body() dto: CreateAegisInstanceDto,
    @CurrentUser() user: User,
  ): Promise<AegisCreateResponse> {
    return this.aegisInstanceService.create(dto, user['custom:tenant_id'])
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an Aegis instance' })
  @ApiParam({ name: 'id', description: 'AegisInstance UUID' })
  @ApiResponse({ status: 200, type: AegisInstance })
  @ApiResponse({ status: 404 })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAegisInstanceDto,
    @CurrentUser() user: User,
  ): Promise<AegisInstance> {
    return this.aegisInstanceService.update(id, dto, user['custom:tenant_id'])
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an Aegis instance' })
  @ApiParam({ name: 'id', description: 'AegisInstance UUID' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404 })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User): Promise<void> {
    return this.aegisInstanceService.remove(id, user['custom:tenant_id'])
  }

  @Post(':id/health-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger a health check on the Aegis instance (validates JWKS endpoint)',
  })
  @ApiParam({ name: 'id', description: 'AegisInstance UUID' })
  @ApiResponse({ status: 200, type: AegisInstance })
  @ApiResponse({ status: 404 })
  healthCheck(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<AegisInstance> {
    return this.aegisInstanceService.healthCheck(id, user['custom:tenant_id'])
  }
}
