import { buildEntities } from './cedar-entity.builder'
import type { CognitoTokenPayload, RequestedEndpoint } from './cedar-entity.builder'

const BASE_ENDPOINT: RequestedEndpoint = {
  host:        'payments.internal',
  method:      'GET',
  path:        '/v1/orders/{id}',
  operationId: 'getOrderById',
  relayId:     'relay-01',
  environment: 'prod',
  tags:        ['orders', 'read-only'],
}

describe('buildEntities', () => {
  it('builds User entity with correct attributes from a direct Cognito token', () => {
    const token: CognitoTokenPayload = {
      sub:              'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'cognito:username': 'alice@acme.com',
      email:            'alice@acme.com',
      email_verified:   true,
      'custom:tenantId': 'acme-corp',
      'cognito:groups': ['platform-engineers', 'billing-viewers'],
      amr:              ['mfa', 'software_totp'],
    }

    const entities = buildEntities(token, BASE_ENDPOINT)

    const user = entities.find(e => (e.uid as { type: string }).type === 'AegisNamespace::User')
    expect(user).toBeDefined()
    expect((user!.uid as { id: string }).id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(user!.attrs['isFederated']).toBe(false)
    expect(user!.attrs['idpProvider']).toBe('COGNITO')
    expect(user!.parents).toHaveLength(2)
  })

  it('marks federated users as isFederated=true with correct idpProvider', () => {
    const token: CognitoTokenPayload = {
      sub:              'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'cognito:username': 'OktaSSO_alice@acme.com',
      email:            'alice@acme.com',
      email_verified:   true,
      'custom:tenantId': 'acme-corp',
      'cognito:groups': ['platform-engineers'],
      amr:              ['external-provider'],
      identities:       JSON.stringify([{ providerName: 'OktaSSO', providerType: 'SAML', primary: true }]),
    }

    const entities = buildEntities(token, BASE_ENDPOINT)
    const user = entities.find(e => (e.uid as { type: string }).type === 'AegisNamespace::User')!

    expect(user.attrs['isFederated']).toBe(true)
    expect(user.attrs['idpProvider']).toBe('OktaSSO')
  })

  it('creates UserGroup entities for each cognito:groups entry', () => {
    const token: CognitoTokenPayload = {
      sub:              'user-1',
      'cognito:groups': ['analysts', 'billing-viewers', 'external-contractors'],
      amr:              ['pwd'],
    }

    const entities = buildEntities(token, { ...BASE_ENDPOINT, environment: 'staging' })
    const groups = entities.filter(e => (e.uid as { type: string }).type === 'AegisNamespace::UserGroup')
    expect(groups).toHaveLength(3)
    expect(groups.map(g => (g.uid as { id: string }).id)).toContain('analysts')
  })

  it('creates ApiEnvironment, ApiHost, and ApiEndpoint entities', () => {
    const token: CognitoTokenPayload = { sub: 'user-1', amr: ['pwd'] }
    const entities = buildEntities(token, BASE_ENDPOINT)

    const env = entities.find(e => (e.uid as { type: string }).type === 'AegisNamespace::ApiEnvironment')
    expect((env!.uid as { id: string }).id).toBe('prod')

    const host = entities.find(e => (e.uid as { type: string }).type === 'AegisNamespace::ApiHost')
    expect((host!.uid as { id: string }).id).toBe('payments.internal')
    expect(host!.parents).toEqual([{ type: 'AegisNamespace::ApiEnvironment', id: 'prod' }])

    const endpoint = entities.find(e => (e.uid as { type: string }).type === 'AegisNamespace::ApiEndpoint')
    expect((endpoint!.uid as { id: string }).id).toBe('getOrderById')
    expect(endpoint!.parents).toEqual([{ type: 'AegisNamespace::ApiHost', id: 'payments.internal' }])
  })

  it('falls back to METHOD:path as operationId when none supplied', () => {
    const token: CognitoTokenPayload = { sub: 'user-1', amr: ['pwd'] }
    const endpoint: RequestedEndpoint = {
      host:    'orders.internal',
      method:  'POST',
      path:    '/v1/orders',
      relayId: 'relay-01',
    }
    const entities = buildEntities(token, endpoint)
    const ep = entities.find(e => (e.uid as { type: string }).type === 'AegisNamespace::ApiEndpoint')!
    expect((ep.uid as { id: string }).id).toBe('POST:/v1/orders')
  })
})
