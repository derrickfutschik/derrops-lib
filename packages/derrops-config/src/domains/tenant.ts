import type { ConfigInput } from '../schema'

export function makeTenantConfig(_input: ConfigInput) {
  return {
    global: {
      id: 't-glbl0000',
      name: 'Derrops Global Tenant',
      active: true, // POC filler
    },
    id: {
      chars: 'abcdefghjkmnpqrstuvwxyz23456789',
      no: 8,
      prefix: 't-',
      exampleLabel: 'customer', // POC filler
    },
  }
}
