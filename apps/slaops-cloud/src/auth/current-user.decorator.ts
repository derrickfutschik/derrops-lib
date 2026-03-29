import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { type CognitoClaims, COGNITO_CLAIMS_KEY } from './cognito.guard'

/**
 * Parameter decorator that extracts the verified Cognito claims attached by
 * CognitoGuard. Use on controller method parameters to get the caller's
 * identity without trusting any client-supplied headers.
 *
 * @example
 * \@UseGuards(CognitoGuard)
 * \@Get('connection')
 * findAll(\@CurrentUser() user: CognitoClaims) {
 *   return this.service.findAll(user.tenantId)
 * }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CognitoClaims => {
    const request = ctx.switchToHttp().getRequest<Request & { [COGNITO_CLAIMS_KEY]: CognitoClaims }>()
    return request[COGNITO_CLAIMS_KEY]
  },
)
