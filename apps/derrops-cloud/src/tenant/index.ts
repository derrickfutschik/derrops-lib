import crypto from 'crypto'

import { config } from '@derrops/config'

/**
 * Generates a unique tenant ID
 * The tenant ID is a 8 character string composed of the characters in the config['tenant.id.chars']
 * and the length of the tenant ID is specified in the config['tenant.id.no']
 * The tenant ID is prefixed with the config['tenant.id.prefix']
 * @returns A unique tenant ID
 */
export function generateTenantId() {
  const bytes = crypto.randomBytes(config['tenant.id.no'])
  const id = Array.from(bytes)
    .map((b) => config['tenant.id.chars'][b % config['tenant.id.chars'].length])
    .join('')
  return `${config['tenant.id.prefix']}${id}`
}
