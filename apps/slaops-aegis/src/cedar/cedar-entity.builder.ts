import type { CedarValueJson, EntityJson } from '@cedar-policy/cedar-wasm/nodejs'

export interface CognitoTokenPayload {
  sub: string
  username?: string
  'cognito:username'?: string
  email?: string
  email_verified?: boolean
  'custom:tenantId'?: string
  'cognito:groups'?: string[]
  identities?: string | Array<{ providerName?: string; providerType?: string }>
  amr?: string[]
  auth_time?: number
  iat?: number
  exp?: number
  nbf?: number
  aud?: string
  client_id?: string
  locale?: string
  phone_number_verified?: boolean
  updated_at?: number | string
}

export interface RequestedEndpoint {
  host: string
  method: string
  path: string
  operationId?: string
  relayId: string
  environment?: string
  tags?: string[]
}

/**
 * Builds the Cedar entity graph for a single authorization query.
 * Produces User, UserGroup, ApiEnvironment, ApiHost, and ApiEndpoint entities.
 */
export function buildEntities(
  token: CognitoTokenPayload,
  endpoint: RequestedEndpoint,
): EntityJson[] {
  const entities: EntityJson[] = []

  const groups: string[] = token['cognito:groups'] ?? []
  const isFederated = (token.amr ?? []).includes('external-provider')
  const idpProvider = resolveIdpProvider(token, isFederated)
  const username = token['cognito:username'] ?? token.username ?? token.sub

  // UserGroup entities
  for (const group of groups) {
    entities.push({
      uid: { type: 'AegisNamespace::UserGroup', id: group },
      attrs: { displayName: group },
      parents: [],
    })
  }

  // User entity
  const userAttrs: Record<string, CedarValueJson> = {
    sub: token.sub,
    username,
    email: token.email ?? '',
    emailVerified: token.email_verified ?? false,
    tenantId: token['custom:tenantId'] ?? '',
    isFederated,
    idpProvider,
  }

  if (token.locale != null) {
    userAttrs['locale'] = token.locale
  }
  if (token.phone_number_verified != null) {
    userAttrs['phoneVerified'] = token.phone_number_verified
  }
  if (token.updated_at != null) {
    userAttrs['updatedAt'] = String(token.updated_at)
  }

  entities.push({
    uid: { type: 'AegisNamespace::User', id: token.sub },
    attrs: userAttrs,
    parents: groups.map((g) => ({ type: 'AegisNamespace::UserGroup', id: g })),
  })

  const environment = endpoint.environment ?? 'default'
  const operationId = endpoint.operationId ?? `${endpoint.method.toUpperCase()}:${endpoint.path}`

  // ApiEnvironment entity
  entities.push({
    uid: { type: 'AegisNamespace::ApiEnvironment', id: environment },
    attrs: { name: environment },
    parents: [],
  })

  // ApiHost entity (child of ApiEnvironment)
  entities.push({
    uid: { type: 'AegisNamespace::ApiHost', id: endpoint.host },
    attrs: { hostname: endpoint.host, internal: false },
    parents: [{ type: 'AegisNamespace::ApiEnvironment', id: environment }],
  })

  // ApiEndpoint entity (child of ApiHost)
  const tags: CedarValueJson[] = (endpoint.tags ?? []).map((t) => t)
  entities.push({
    uid: { type: 'AegisNamespace::ApiEndpoint', id: operationId },
    attrs: {
      operationId,
      method: endpoint.method.toUpperCase(),
      pathPattern: endpoint.path,
      tags,
    },
    parents: [{ type: 'AegisNamespace::ApiHost', id: endpoint.host }],
  })

  return entities
}

function resolveIdpProvider(token: CognitoTokenPayload, isFederated: boolean): string {
  if (!isFederated) return 'COGNITO'

  const identities = token.identities
  if (!identities) return 'EXTERNAL_IDP'

  const parsed: Array<{ providerName?: string }> =
    typeof identities === 'string'
      ? (JSON.parse(identities) as Array<{ providerName?: string }>)
      : identities

  return parsed[0]?.providerName ?? 'EXTERNAL_IDP'
}
