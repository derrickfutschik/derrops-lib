import type { InjectedSecret } from '../template/template-resolver'
import { env } from '../env'

export type MaskingResult = {
  maskedSecretIds: string[]
  bodyMasked: boolean
  headersMasked: boolean
}

/**
 * Scan the response body and headers for any injected secret values and
 * replace them with [REDACTED:<secretId>].
 *
 * - Only secrets fetched from the secret store are tracked (JIT values are not).
 * - Secrets shorter than the configured minimum length are skipped (collision risk).
 * - Masking is exact-string, case-sensitive.
 * - Cannot be disabled by the caller.
 */
export function maskSecrets(
  body: string,
  headers: Record<string, string>,
  injectedSecrets: InjectedSecret[],
): { body: string; headers: Record<string, string>; masking: MaskingResult } {
  const masking: MaskingResult = { maskedSecretIds: [], bodyMasked: false, headersMasked: false }
  const minLen = env.relay.minSecretMaskLength

  let maskedBody = body
  const maskedHeaders = { ...headers }

  for (const secret of injectedSecrets) {
    if (secret.value.length < minLen) {
      // Too short — skip masking; callers should avoid short secrets
      continue
    }

    const redaction = `[REDACTED:${secret.id}]`

    if (maskedBody.includes(secret.value)) {
      maskedBody = maskedBody.replaceAll(secret.value, redaction)
      masking.bodyMasked = true
      if (!masking.maskedSecretIds.includes(secret.id)) {
        masking.maskedSecretIds.push(secret.id)
      }
    }

    for (const [headerName, headerValue] of Object.entries(maskedHeaders)) {
      if (headerValue.includes(secret.value)) {
        maskedHeaders[headerName] = headerValue.replaceAll(secret.value, redaction)
        masking.headersMasked = true
        if (!masking.maskedSecretIds.includes(secret.id)) {
          masking.maskedSecretIds.push(secret.id)
        }
      }
    }
  }

  return { body: maskedBody, headers: maskedHeaders, masking }
}
