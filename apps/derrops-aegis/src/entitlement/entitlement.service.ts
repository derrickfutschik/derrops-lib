import { Injectable } from '@nestjs/common'
import { env } from '../env'

export interface UserEntitlement {
  relayId: string
  allowedMethods: string[]
  pathPatterns: string[]
}

export interface EntitlementResponse {
  userId: string
  tenantId: string
  relays: UserEntitlement[]
}

/**
 * Stage 1: config-driven entitlements.
 * All users in a tenant get access to the configured relay IDs.
 * Replace with a database-backed policy store in a future stage.
 */
@Injectable()
export class EntitlementService {
  getEntitlements(userId: string, tenantId: string): EntitlementResponse {
    const relays: UserEntitlement[] = env.relay.allowedIds.map((relayId) => ({
      relayId,
      allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      pathPatterns: ['*'],
    }))

    return { userId, tenantId, relays }
  }
}
