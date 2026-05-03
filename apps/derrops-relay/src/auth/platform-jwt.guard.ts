import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { env } from '../env'
import { JwksCacheService } from './jwks-cache.service'

/** Issuer claim expected on platform JWTs. */
const PLATFORM_ISS = 'https://api.derrops.com'

@Injectable()
export class PlatformJwtGuard implements CanActivate {
  private readonly logger = new Logger(PlatformJwtGuard.name)

  constructor(private readonly jwksCache: JwksCacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Record<string, any>>()
    const auth: string = req.headers['authorization'] ?? ''

    if (!auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token')
    }

    const token = auth.slice(7).trim()
    const relayId = env.jwt.relayId
    const jwksUrl = env.jwt.vendorJwksUrl

    if (!relayId || !jwksUrl) {
      // JWT auth not configured — allow in development
      this.logger.warn(
        'RELAY_ID or DERROPS_VENDOR_JWKS_URL not set — skipping JWT validation (development mode)',
      )
      return true
    }

    const { jwtVerify, createLocalJWKSet } = await import('jose')

    const keys = await this.jwksCache.getKeys(jwksUrl)
    const JWKS = createLocalJWKSet({ keys: keys as any[] })

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: PLATFORM_ISS,
        audience: relayId,
      })
      req['platformJwtPayload'] = payload
      return true
    } catch (err) {
      this.logger.warn(`Platform JWT verification failed: ${(err as Error).message}`)
      // Invalidate cache in case keys rotated
      this.jwksCache.invalidate(jwksUrl)
      throw new UnauthorizedException('Invalid platform JWT')
    }
  }
}
