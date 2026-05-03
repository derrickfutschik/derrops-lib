import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { CloudRelayService } from './cloud-relay.service'
import type { CloudRelayConnection } from './entities/cloud-relay-connection.entity'

export const RELAY_CONNECTION_KEY = 'relayConnection'

/**
 * RelayConnectionGuard — authenticates relay-to-platform requests using the connection's api_key.
 *
 * The relay sends `Authorization: Bearer <api_key>`. This guard resolves the connection and
 * attaches it to the request for retrieval via @CurrentConnection().
 */
@Injectable()
export class RelayConnectionGuard implements CanActivate {
  constructor(private readonly cloudRelayService: CloudRelayService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    const apiKey = type === 'Bearer' ? token : undefined

    if (!apiKey) {
      throw new UnauthorizedException('Missing relay API key')
    }

    const connection = await this.cloudRelayService.findConnectionByApiKey(apiKey)
    ;(request as Request & { [RELAY_CONNECTION_KEY]: CloudRelayConnection })[RELAY_CONNECTION_KEY] =
      connection
    return true
  }
}
