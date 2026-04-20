import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { env } from '../env'

/** Default algorithm for Aegis signing keys. */
const SIGNING_ALG = 'ES256'

@Injectable()
export class SigningKeyService implements OnModuleInit {
  private readonly logger = new Logger(SigningKeyService.name)

  // Use `any` to avoid coupling to jose's internal key types across ESM/CJS boundaries.
  private privateKey: any
  private publicKeyJwk: Record<string, unknown>
  readonly kid: string = env.signing.keyId

  async onModuleInit(): Promise<void> {
    if (env.signing.keyJwk) {
      this.logger.log('Loading Aegis signing key from AEGIS_SIGNING_KEY')
      await this.loadFromJson(env.signing.keyJwk)
    } else {
      this.logger.warn(
        'AEGIS_SIGNING_KEY not set — generating ephemeral key (development only). ' +
          'Set AEGIS_SIGNING_KEY (JWK JSON) in production.',
      )
      await this.generateEphemeralKey()
    }
  }

  private async loadFromJson(json: string): Promise<void> {
    const { importJWK } = await import('jose')
    const jwk = JSON.parse(json) as Record<string, unknown>
    this.privateKey = await importJWK(jwk as any, SIGNING_ALG)
    const { d: _d, ...publicJwk } = jwk
    this.publicKeyJwk = { ...publicJwk, kid: this.kid, use: 'sig', alg: SIGNING_ALG }
  }

  private async generateEphemeralKey(): Promise<void> {
    const { generateKeyPair, exportJWK } = await import('jose')
    const { privateKey, publicKey } = await generateKeyPair(SIGNING_ALG, { extractable: true })
    this.privateKey = privateKey
    const jwk = await exportJWK(publicKey)
    this.publicKeyJwk = { ...jwk, kid: this.kid, use: 'sig', alg: SIGNING_ALG }
  }

  /**
   * Sign a session delegation JWT.
   * Claims beyond the standard ones (iss, sub, aud, iat, exp, jti) are passed in `payload`.
   */
  async signJwt(
    payload: Record<string, unknown>,
    subject: string,
    audience: string,
  ): Promise<string> {
    const { SignJWT } = await import('jose')
    const now = Math.floor(Date.now() / 1000)
    return new SignJWT(payload)
      .setProtectedHeader({ alg: SIGNING_ALG, kid: this.kid })
      .setIssuer(env.signing.issuer)
      .setSubject(subject)
      .setAudience(audience)
      .setIssuedAt(now)
      .setExpirationTime(now + env.signing.sessionTtlS)
      .setJti(randomUUID())
      .sign(this.privateKey)
  }

  /** Returns the JWKS document containing the Aegis public signing key. */
  getJwks(): { keys: object[] } {
    return { keys: [this.publicKeyJwk] }
  }
}
