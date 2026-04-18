import { createHash } from 'node:crypto'

/**
 * Generate a deterministic document ID for OASpec OpenSearch documents.
 * Format: "{tenantId}-{first 16 hex chars of SHA-256(fields joined with '|')}"
 */
export function oaspecId(tenantId: string, ...fields: string[]): string {
  const hash = createHash('sha256').update(fields.join('|'), 'utf8').digest('hex').slice(0, 16)
  return `${tenantId}-${hash}`
}
