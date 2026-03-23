import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { env } from '../env'
import { SigningKeyService } from '../jwks/signing-key.service'

/** Timeout for the registration handshake HTTP request (milliseconds). */
const REGISTRATION_TIMEOUT_MS = 15_000

/**
 * Completes the Aegis registration handshake with the SLAOps platform at startup.
 *
 * If SLAOPS_REGISTRATION_TOKEN and SLAOPS_PLATFORM_URL are both set, this service
 * posts the token and Aegis's JWKS URL to the platform. On success, the platform
 * transitions the aegis_instance from `pending` → `active` and invalidates the token.
 *
 * The JWKS URL is derived from AEGIS_ISSUER (the public URL of this Aegis deployment).
 */
@Injectable()
export class RegistrationService implements OnModuleInit {
  private readonly logger = new Logger(RegistrationService.name)

  constructor(private readonly signingKey: SigningKeyService) {}

  async onModuleInit(): Promise<void> {
    const { registrationToken, url: platformUrl } = env.platform

    if (!registrationToken || !platformUrl) {
      this.logger.log(
        'SLAOPS_REGISTRATION_TOKEN or SLAOPS_PLATFORM_URL not set — skipping registration handshake',
      )
      return
    }

    await this.performHandshake(platformUrl, registrationToken)
  }

  private async performHandshake(platformUrl: string, registrationToken: string): Promise<void> {
    const jwksUrl = `${env.signing.issuer}/.well-known/jwks.json`
    const endpoint = `${platformUrl}/cloud-relay/aegis/register`

    this.logger.log(`Performing registration handshake with platform at ${endpoint}`)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REGISTRATION_TIMEOUT_MS)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ registrationToken, jwksUrl }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      if (response.ok) {
        this.logger.log('Registration handshake succeeded — Aegis instance is now active')
        this.logger.log('Remove SLAOPS_REGISTRATION_TOKEN from the environment (token is now consumed)')
      } else {
        const text = await response.text()
        this.logger.warn(
          `Registration handshake failed (HTTP ${response.status}): ${text}. ` +
            'The platform may have already processed this token. Check instance status in the portal.',
        )
      }
    } catch (err) {
      this.logger.error(
        `Registration handshake request failed: ${(err as Error).message}. ` +
          'Aegis will continue running but remains in pending status until the handshake succeeds.',
      )
    }
  }
}
