import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { env } from '../env'
import { SigningKeyService } from '../jwks/signing-key.service'
import { DelegationScopeDto, SessionResponseDto } from './dto/session-response.dto'
import { RequestedScopeDto, RequestSessionDto } from './dto/request-session.dto'

/** In-memory revocation set — stores JTI values of revoked sessions. */
const revokedJtis = new Set<string>()

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name)

  constructor(private readonly signingKey: SigningKeyService) {}

  async issueSession(dto: RequestSessionDto): Promise<SessionResponseDto> {
    // 1. Validate user token against the customer IdP JWKS
    const userId = await this.validateUserToken(dto.userToken)

    // 2. Evaluate which requested scopes are allowed
    const grantedScopes: DelegationScopeDto[] = []
    const deniedScopes: { relayId: string; reason: string }[] = []

    for (const scope of dto.requestedScopes) {
      if (!env.relay.allowedIds.includes(scope.relayId)) {
        this.logger.warn(`Relay ${scope.relayId} is not in ALLOWED_RELAY_IDS — denying scope`)
        deniedScopes.push({ relayId: scope.relayId, reason: 'Relay not in allowlist' })
        continue
      }
      // Stage 1: grant all-access for allowed relays (policy is config-driven by ALLOWED_RELAY_IDS)
      grantedScopes.push({
        apiId: scope.apiId,
        environment: scope.environment,
        allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        pathPatterns: ['*'],
        relayIds: [scope.relayId],
      })
    }

    if (grantedScopes.length === 0 && dto.requestedScopes.length > 0) {
      throw new UnauthorizedException('No requested scopes were granted')
    }

    // 3. Sign the session delegation JWT
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = new Date((now + env.signing.sessionTtlS) * 1000).toISOString()

    const jwtPayload: Record<string, unknown> = {
      tenantId: dto.tenantId,
      scopes: grantedScopes,
    }

    const audience = env.platform.url ?? 'https://api.slaops.com'
    const jwt = await this.signingKey.signJwt(jwtPayload, userId, audience)

    this.logger.log(`Issued session delegation JWT for user ${userId} (tenant ${dto.tenantId})`)

    return { sessionDelegationJWT: jwt, expiresAt, grantedScopes, deniedScopes }
  }

  revokeSession(jti: string): void {
    revokedJtis.add(jti)
    this.logger.log(`Revoked session JWT ${jti}`)
  }

  isRevoked(jti: string): boolean {
    return revokedJtis.has(jti)
  }

  private async validateUserToken(userToken: string): Promise<string> {
    const jwksUrl = env.idp.jwksUrl

    if (!jwksUrl) {
      this.logger.warn('CUSTOMER_IDP_JWKS_URL not set — skipping IdP token validation (development mode)')
      // In dev, extract sub without validation
      return this.extractSubWithoutVerification(userToken)
    }

    const { jwtVerify, createRemoteJWKSet } = await import('jose')
    const JWKS = createRemoteJWKSet(new URL(jwksUrl))

    try {
      const { payload } = await jwtVerify(userToken, JWKS)
      const sub = payload.sub
      if (!sub) throw new UnauthorizedException('IdP token missing sub claim')
      return sub
    } catch (err) {
      this.logger.warn(`IdP token validation failed: ${(err as Error).message}`)
      throw new UnauthorizedException('Invalid user token')
    }
  }

  private extractSubWithoutVerification(token: string): string {
    try {
      const [, payloadB64] = token.split('.')
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as { sub?: string }
      return payload.sub ?? 'dev-user'
    } catch {
      return 'dev-user'
    }
  }
}
