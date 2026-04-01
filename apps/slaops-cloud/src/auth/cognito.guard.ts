import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Request } from 'express'
import { config } from '@slaops/config'

export interface CognitoClaims {
  /** Cognito User Pool subject — stable UUID per user, used as userId. */
  sub: string
  /** Tenant the user belongs to — injected by the Pre-Token Generation Lambda. Not a Cognito custom attribute. */
  tenantId: string
  email?: string
  [key: string]: unknown
}

/** Key on the Express request where verified claims are attached. */
export const COGNITO_CLAIMS_KEY = 'cognitoClaims'

/**
 * CognitoGuard — verifies the Cognito id_token (or access_token) sent as
 * `Authorization: Bearer <token>` and attaches the verified claims to the request.
 *
 * Uses jose's createRemoteJWKSet which fetches and caches the Cognito JWKS
 * automatically, re-fetching only when a new `kid` is seen.
 *
 * Controllers extract claims via the @CurrentUser() decorator.
 */
@Injectable()
export class CognitoGuard implements CanActivate {
  private readonly logger = new Logger(CognitoGuard.name)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>
  private readonly issuer: string

  constructor() {
    const region = config['aws.region']
    const userPoolId = config['aws.cognito.userPoolId']
    const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
    this.issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`
    this.jwks = createRemoteJWKSet(new URL(jwksUri))
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const token = this.extractBearer(request)

    if (!token) {
      throw new UnauthorizedException('Missing Authorization Bearer token')
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        algorithms: ['RS256'],
      })

      if (!payload.sub) {
        throw new UnauthorizedException('Token missing sub claim')
      }

      if (!payload['tenantId']) {
        throw new UnauthorizedException(
          'Token missing tenantId claim — user may not be assigned to a tenant',
        )
      }

      // Attach to request for @CurrentUser() to pick up
      ;(request as Request & { [COGNITO_CLAIMS_KEY]: CognitoClaims })[COGNITO_CLAIMS_KEY] =
        payload as unknown as CognitoClaims

      return true
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err
      this.logger.debug(`JWT verification failed: ${(err as Error).message}`)
      throw new UnauthorizedException('Invalid or expired token')
    }
  }

  private extractBearer(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}
