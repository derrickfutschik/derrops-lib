import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SigningKeyService } from './signing-key.service'

@ApiTags('JWKS')
@Controller('.well-known')
export class JwksController {
  constructor(private readonly signingKeyService: SigningKeyService) {}

  @Get('jwks.json')
  @ApiOperation({ summary: 'Aegis JWKS endpoint — used by the relay and the platform to validate session delegation JWTs' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { keys: { type: 'array', items: { type: 'object' } } } },
  })
  getJwks(): { keys: object[] } {
    return this.signingKeyService.getJwks()
  }
}
