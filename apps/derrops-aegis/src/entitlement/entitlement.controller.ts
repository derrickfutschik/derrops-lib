import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { EntitlementResponse, EntitlementService } from './entitlement.service'

@ApiTags('Entitlement')
@Controller('v1/entitlement')
export class EntitlementController {
  constructor(private readonly entitlementService: EntitlementService) {}

  @Get()
  @ApiOperation({
    summary: 'List relay entitlements for a user',
    description:
      'Returns the relay IDs and allowed operations for the given user. ' +
      'Stage 1: entitlements are derived from the ALLOWED_RELAY_IDS configuration.',
  })
  @ApiQuery({ name: 'userId', required: true, description: 'User identifier (sub from IdP token)' })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant identifier' })
  @ApiResponse({ status: 200 })
  getEntitlements(
    @Query('userId') userId: string,
    @Query('tenantId') tenantId: string,
  ): EntitlementResponse {
    return this.entitlementService.getEntitlements(userId, tenantId)
  }
}
