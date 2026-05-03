import type { CedarValueJson } from '@cedar-policy/cedar-wasm/nodejs'
import type { CognitoTokenPayload, RequestedEndpoint } from './cedar-entity.builder'

export type CedarContext = Record<string, CedarValueJson>

/**
 * Builds the Cedar context record from the validated Cognito token payload,
 * the endpoint being requested, and the caller's IP address.
 */
export function buildContext(
  token: CognitoTokenPayload,
  endpoint: RequestedEndpoint,
  ipAddress: string,
): CedarContext {
  const now = new Date()
  const nowEpoch = Math.floor(now.getTime() / 1000)

  const iat = token.iat ?? nowEpoch
  const exp = token.exp ?? nowEpoch + 3600
  const nbf = token.nbf ?? iat

  return {
    mfaVerified: deriveMfaVerified(token),
    authMethod: deriveAuthMethod(token),
    authTime: epochToIso(token.auth_time ?? iat),
    tokenAud: token.client_id ?? (token.aud as string | undefined) ?? '',
    tokenIat: epochToIso(iat),
    tokenNbf: epochToIso(nbf),
    tokenAgeSeconds: Math.max(0, nowEpoch - iat),
    tokenExpiresInSeconds: Math.max(0, exp - nowEpoch),
    ipAddress,
    time: now.toISOString(),
    timeOfDayHour: now.getUTCHours(),
    relayId: endpoint.relayId,
    environment: endpoint.environment ?? 'default',
  }
}

function deriveMfaVerified(token: CognitoTokenPayload): boolean {
  const amr = token.amr ?? []
  return amr.includes('mfa')
}

function deriveAuthMethod(token: CognitoTokenPayload): string {
  const amr = token.amr ?? []
  if (amr.includes('external-provider')) return 'EXTERNAL_IDP'
  if (amr.includes('software_totp')) return 'SOFTWARE_TOTP'
  if (amr.includes('hardware_totp')) return 'HARDWARE_TOTP'
  return 'PASSWORD'
}

function epochToIso(epoch: number): string {
  return new Date(epoch * 1000).toISOString()
}
