import { createHash } from 'crypto'
import type { InjectedSecret } from '../template/template-resolver'
import { env } from '../env'

export type MaskingResult = {
  /** Full secret URIs (safe to surface — contain no secret material) whose values were found in the response. */
  maskedSecretUris: string[]
  bodyMasked: boolean
  headersMasked: boolean
}

/**
 * Build a safe redaction label for a secret URI.
 * Format: [REDACTED:scheme:pathHash] where pathHash is the first 8 hex chars
 * of SHA-256(uri). Includes the scheme for traceability without the full path.
 */
function redactionLabel(uri: string): string {
  const schemeSep = uri.indexOf('://')
  const scheme = schemeSep === -1 ? 'secret' : uri.slice(0, schemeSep)
  const hash = createHash('sha256').update(uri).digest('hex').slice(0, 8)
  return `[REDACTED:${scheme}:${hash}]`
}

/**
 * Scan the response body and headers for any injected secret values and
 * replace them with [REDACTED:scheme:hash].
 *
 * - Only secrets fetched from a secret store are tracked (JIT values are not).
 * - Secrets whose resolved value is shorter than the configured minimum length
 *   are skipped (too short → collision-prone; callers should avoid short secrets).
 * - Masking is exact-string, case-sensitive.
 * - Cannot be disabled by the caller.
 */
export function maskSecrets(
  body: string,
  headers: Record<string, string>,
  injectedSecrets: InjectedSecret[],
): { body: string; headers: Record<string, string>; masking: MaskingResult } {
  const masking: MaskingResult = { maskedSecretUris: [], bodyMasked: false, headersMasked: false }
  const minLen = env.relay.minSecretMaskLength

  let maskedBody = body
  const maskedHeaders = { ...headers }

  for (const secret of injectedSecrets) {
    if (secret.value.length < minLen) {
      // Too short — skip masking to avoid false positives
      continue
    }

    const redaction = redactionLabel(secret.uri)

    if (maskedBody.includes(secret.value)) {
      maskedBody = maskedBody.replaceAll(secret.value, redaction)
      masking.bodyMasked = true
      if (!masking.maskedSecretUris.includes(secret.uri)) {
        masking.maskedSecretUris.push(secret.uri)
      }
    }

    for (const [headerName, headerValue] of Object.entries(maskedHeaders)) {
      if (headerValue.includes(secret.value)) {
        maskedHeaders[headerName] = headerValue.replaceAll(secret.value, redaction)
        masking.headersMasked = true
        if (!masking.maskedSecretUris.includes(secret.uri)) {
          masking.maskedSecretUris.push(secret.uri)
        }
      }
    }
  }

  return { body: maskedBody, headers: maskedHeaders, masking }
}
