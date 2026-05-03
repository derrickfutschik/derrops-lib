import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { PlatformJwtGuard } from '../auth/platform-jwt.guard'
import { env } from '../env'

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @UseGuards(PlatformJwtGuard)
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer <platform-jwt>' })
  @ApiOperation({
    summary:
      'Health check (called by derrops-cloud to confirm relay is reachable and trusts the platform)',
    description:
      'The platform mints a short-lived JWT scoped to this relay ID and calls this endpoint. ' +
      'A successful response confirms both network reachability and JWT trust.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        relayId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid platform JWT' })
  check(): { status: string; relayId: string } {
    return { status: 'ok', relayId: env.jwt.relayId ?? 'unregistered' }
  }
}
