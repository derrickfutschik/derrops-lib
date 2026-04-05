import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RequestSessionDto } from './dto/request-session.dto'
import { SessionResponseDto } from './dto/session-response.dto'
import { SessionService } from './session.service'

@ApiTags('Session')
@Controller('v1/session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Issue a session delegation JWT',
    description:
      'The browser authenticates the user with Cognito (directly or via a federated IdP) and submits the ' +
      'access token here with the list of API endpoints it needs access to. ' +
      'Aegis validates the token, builds Cedar entities from the Cognito claims, and evaluates the ' +
      'customer Cedar policies for each requested endpoint. ' +
      'A signed session delegation JWT is returned containing only the permitted endpoints.',
  })
  @ApiResponse({ status: 201, type: SessionResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid user token or no scopes granted' })
  issue(@Body() dto: RequestSessionDto): Promise<SessionResponseDto> {
    return this.sessionService.issueSession(dto)
  }

  @Delete(':jti')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke a session delegation JWT by JTI',
    description: 'Adds the JTI to the in-memory revocation set. Relay will reject jobs carrying this JWT on next validation.',
  })
  @ApiParam({ name: 'jti', description: 'JTI (unique ID) of the session delegation JWT to revoke' })
  @ApiResponse({ status: 204 })
  revoke(@Param('jti') jti: string): void {
    this.sessionService.revokeSession(jti)
  }
}
