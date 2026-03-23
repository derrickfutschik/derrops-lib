import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AegisInstanceService } from './aegis-instance.service'
import { AegisRegisterDto } from './dto/aegis-register.dto'
import { AegisInstance } from './entities/aegis-instance.entity'

/**
 * Handles the registration handshake callback called by the Aegis Broker itself
 * (not by the portal). Lives at /cloud-relay/aegis/* to keep Aegis concerns together.
 */
@ApiTags('Aegis Instance')
@Controller('cloud-relay/aegis')
export class AegisRegisterController {
  constructor(private readonly aegisInstanceService: AegisInstanceService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete Aegis instance registration (called by Aegis)',
    description:
      'Aegis posts its one-time registration token and JWKS URL. ' +
      'On success the instance transitions from `pending` to `active` and the token is invalidated.',
  })
  @ApiResponse({ status: 200, type: AegisInstance })
  @ApiResponse({ status: 400, description: 'Invalid or already-used registration token' })
  register(@Body() dto: AegisRegisterDto): Promise<AegisInstance> {
    return this.aegisInstanceService.register(dto)
  }
}
