import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { randomUUID } from 'crypto'

/** TTL for relay-scoped JWTs minted by the platform (seconds). */
const RELAY_JWT_TTL_S = 5 * 60

/** Issuer claim for platform-minted JWTs. */
const PLATFORM_ISS = 'https://api.derrops.com'

/** kid assigned to the vendor signing key. */
const VENDOR_KID = 'vendor-1'

@Injectable()
export class VendorJwtService implements OnModuleInit {
  private readonly logger = new Logger(VendorJwtService.name)

  // Use `any` to avoid coupling to jose's internal key types across ESM/CJS boundaries.
  private privateKey: any
  private publicKeyJwk: Record<string, unknown>

  async onModuleInit(): Promise<void> {
    const signingKeyJson = process.env.DERROPS_VENDOR_SIGNING_KEY_JWK

    if (signingKeyJson) {
      this.logger.log('Loading vendor signing key from DERROPS_VENDOR_SIGNING_KEY_JWK')
      await this.loadFromJson(signingKeyJson)
    } else {
      this.logger.warn(
        'DERROPS_VENDOR_SIGNING_KEY_JWK not set — generating ephemeral key (development only)',
      )
      await this.generateEphemeralKey()
    }
  }

  private async loadFromJson(json: string): Promise<void> {
    const { importJWK } = await import('jose')
    const jwk = JSON.parse(json) as Record<string, unknown>
    this.privateKey = await importJWK(jwk as any, 'ES256')
    const { d: _d, ...publicJwk } = jwk
    this.publicKeyJwk = { ...publicJwk, kid: VENDOR_KID, use: 'sig', alg: 'ES256' }
  }

  private async generateEphemeralKey(): Promise<void> {
    const { generateKeyPair, exportJWK } = await import('jose')
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
    this.privateKey = privateKey
    const jwk = await exportJWK(publicKey)
    this.publicKeyJwk = { ...jwk, kid: VENDOR_KID, use: 'sig', alg: 'ES256' }
  }

  async mintRelayJwt(relayId: string): Promise<string> {
    const { SignJWT } = await import('jose')
    const now = Math.floor(Date.now() / 1000)
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: VENDOR_KID })
      .setIssuer(PLATFORM_ISS)
      .setAudience(relayId)
      .setIssuedAt(now)
      .setExpirationTime(now + RELAY_JWT_TTL_S)
      .setJti(randomUUID())
      .sign(this.privateKey)
  }

  getJwks(): { keys: object[] } {
    return { keys: [this.publicKeyJwk] }
  }
}
