import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { RELAY_CONNECTION_KEY } from './relay-connection.guard'
import type { CloudRelayConnection } from './entities/cloud-relay-connection.entity'

export const CurrentConnection = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CloudRelayConnection => {
    const request = ctx.switchToHttp().getRequest()
    return request[RELAY_CONNECTION_KEY]
  },
)
