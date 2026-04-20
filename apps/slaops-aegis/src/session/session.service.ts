import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { env } from '../env'
import { CedarPolicyService } from '../cedar/cedar-policy.service'
import type { CognitoTokenPayload } from '../cedar/cedar-entity.builder'
import { SigningKeyService } from '../jwks/signing-key.service'
import {
  DeniedEndpointDto,
  PermittedEndpointDto,
  SessionResponseDto,
} from './dto/session-response.dto'
import { RequestedEndpointDto, RequestSessionDto } from './dto/request-session.dto'

/** In-memory revocation set — stores JTI values of revoked sessions. */
const revokedJtis = new Set<string>()

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name)

  constructor(
    private readonly signingKey: SigningKeyService,
    private readonly cedarPolicy: CedarPolicyService,
  ) {}

  async issueSession(dto: RequestSessionDto): Promise<SessionResponseDto> {
    // 1. Validate user token and extract full Cognito payload
    const { userId, tokenPayload } = await this.validateUserToken(dto.userToken)

    const ipAddress = dto.ipAddress ?? '0.0.0.0'

    // 2. Evaluate each requested endpoint against Cedar policies
    const permittedEndpoints: PermittedEndpointDto[] = []
    const deniedEndpoints: DeniedEndpointDto[] = []

    for (const endpoint of dto.requestedEndpoints) {
      const result = await this.cedarPolicy.isAuthorized(tokenPayload, endpoint, ipAddress)

      if (result.allowed) {
        permittedEndpoints.push({
          host: endpoint.host,
          method: endpoint.method,
          path: endpoint.path,
          operationId: endpoint.operationId,
          relayId: endpoint.relayId,
          environment: endpoint.environment,
        })
      } else {
        this.logger.warn(
          `Cedar DENY ${endpoint.method} ${endpoint.host}${endpoint.path} ` +
            `for user ${userId}: ${result.reason}`,
        )
        deniedEndpoints.push({
          host: endpoint.host,
          method: endpoint.method,
          path: endpoint.path,
          operationId: endpoint.operationId,
          reason: result.reason ?? 'denied by policy',
        })
      }
    }

    if (permittedEndpoints.length === 0 && dto.requestedEndpoints.length > 0) {
      throw new UnauthorizedException('No requested endpoints were permitted by Cedar policy')
    }

    // 3. Sign the session delegation JWT
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = new Date((now + env.signing.sessionTtlS) * 1000).toISOString()

    const jwtPayload: Record<string, unknown> = {
      tenantId: dto.tenantId,
      permittedEndpoints,
    }

    const audience = env.platform.url ?? 'https://api.slaops.com'
    const jwt = await this.signingKey.signJwt(jwtPayload, userId, audience)

    this.logger.log(
      `Issued session JWT for user ${userId} (tenant ${dto.tenantId}): ` +
        `${permittedEndpoints.length} permitted, ${deniedEndpoints.length} denied`,
    )

    return { sessionDelegationJWT: jwt, expiresAt, permittedEndpoints, deniedEndpoints }
  }

  revokeSession(jti: string): void {
    revokedJtis.add(jti)
    this.logger.log(`Revoked session JWT ${jti}`)
  }

  isRevoked(jti: string): boolean {
    return revokedJtis.has(jti)
  }

  private async validateUserToken(
    userToken: string,
  ): Promise<{ userId: string; tokenPayload: CognitoTokenPayload }> {
    const jwksUrl = env.idp.jwksUrl

    if (!jwksUrl) {
      this.logger.warn(
        'CUSTOMER_IDP_JWKS_URL not set — skipping IdP token validation (development mode)',
      )
      const tokenPayload = this.decodeWithoutVerification(userToken)
      return { userId: tokenPayload.sub ?? 'dev-user', tokenPayload }
    }

    const { jwtVerify, createRemoteJWKSet } = await import('jose')
    const JWKS = createRemoteJWKSet(new URL(jwksUrl))

    try {
      const { payload } = await jwtVerify(userToken, JWKS)
      if (!payload.sub) throw new UnauthorizedException('IdP token missing sub claim')
      return { userId: payload.sub, tokenPayload: payload as unknown as CognitoTokenPayload }
    } catch (err) {
      this.logger.warn(`IdP token validation failed: ${(err as Error).message}`)
      throw new UnauthorizedException('Invalid user token')
    }
  }

  private decodeWithoutVerification(token: string): CognitoTokenPayload {
    try {
      const [, payloadB64] = token.split('.')
      return JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as CognitoTokenPayload
    } catch {
      return { sub: 'dev-user' }
    }
  }
}
