import * as path from 'path'
import { CedarPolicyService } from './cedar-policy.service'
import type { CognitoTokenPayload, RequestedEndpoint } from './cedar-entity.builder'

// Examples directory ships with schema.json + example policies — used as the integration test fixture
// __dirname is src/cedar; go up two levels to reach the app root, then into policies/examples
const EXAMPLES_DIR = path.resolve(__dirname, '../..', 'policies/examples')

const NOW = Math.floor(Date.now() / 1000)

function makeToken(
  groups: string[],
  amr: string[] = ['mfa', 'software_totp'],
): CognitoTokenPayload {
  return {
    sub: 'test-user-sub',
    'cognito:username': 'testuser',
    email: 'test@acme.com',
    email_verified: true,
    'custom:tenantId': 'acme-corp',
    'cognito:groups': groups,
    amr,
    iat: NOW - 60,
    exp: NOW + 3540,
    auth_time: NOW - 60,
    client_id: 'test-client',
  }
}

function makeEndpoint(
  method: string,
  environment: string,
  override: Partial<RequestedEndpoint> = {},
): RequestedEndpoint {
  return {
    host: 'payments.internal',
    method,
    path: '/v1/orders/{id}',
    operationId: 'getOrderById',
    relayId: 'relay-01',
    environment,
    ...override,
  }
}

describe('CedarPolicyService (integration with example policies)', () => {
  let svc: CedarPolicyService

  beforeAll(async () => {
    svc = new CedarPolicyService()
    await svc.loadPolicies(EXAMPLES_DIR)
  })

  describe('analysts group — read-only on staging', () => {
    it('permits GET on staging', async () => {
      const result = await svc.isAuthorized(
        makeToken(['analysts']),
        makeEndpoint('GET', 'staging'),
        '10.0.0.1',
      )
      expect(result.allowed).toBe(true)
    })

    it('denies POST on staging (no write permit for analysts)', async () => {
      const result = await svc.isAuthorized(
        makeToken(['analysts']),
        makeEndpoint('POST', 'staging'),
        '10.0.0.1',
      )
      expect(result.allowed).toBe(false)
    })

    it('denies GET on prod (analysts are staging-only)', async () => {
      const result = await svc.isAuthorized(
        makeToken(['analysts']),
        makeEndpoint('GET', 'prod'),
        '10.0.0.1',
      )
      expect(result.allowed).toBe(false)
    })
  })

  describe('platform-engineers group', () => {
    it('permits GET on prod', async () => {
      const result = await svc.isAuthorized(
        makeToken(['platform-engineers'], ['mfa', 'software_totp']),
        makeEndpoint('GET', 'prod'),
        '10.0.0.1',
      )
      expect(result.allowed).toBe(true)
    })

    it('permits POST on prod when MFA is verified', async () => {
      const result = await svc.isAuthorized(
        makeToken(['platform-engineers'], ['mfa', 'software_totp']),
        makeEndpoint('POST', 'prod'),
        '10.0.0.1',
      )
      expect(result.allowed).toBe(true)
    })

    it('denies POST on prod without MFA', async () => {
      const result = await svc.isAuthorized(
        makeToken(['platform-engineers'], ['pwd']),
        makeEndpoint('POST', 'prod'),
        '10.0.0.1',
      )
      expect(result.allowed).toBe(false)
    })

    it('permits POST on staging without MFA', async () => {
      const result = await svc.isAuthorized(
        makeToken(['platform-engineers'], ['pwd']),
        makeEndpoint('POST', 'staging'),
        '10.0.0.1',
      )
      expect(result.allowed).toBe(true)
    })
  })

  describe('global deny-global-delete policy', () => {
    it('denies DELETE even for platform-engineers with MFA', async () => {
      const result = await svc.isAuthorized(
        makeToken(['platform-engineers'], ['mfa', 'software_totp']),
        makeEndpoint('DELETE', 'prod'),
        '10.0.0.1',
      )
      expect(result.allowed).toBe(false)
    })
  })

  describe('user with no matching group', () => {
    it('denies all access (default deny)', async () => {
      const result = await svc.isAuthorized(
        makeToken(['unknown-group']),
        makeEndpoint('GET', 'staging'),
        '10.0.0.1',
      )
      expect(result.allowed).toBe(false)
    })
  })

  describe('empty policy set', () => {
    it('returns denied with reason when no policies loaded', async () => {
      const emptySvc = new CedarPolicyService()
      // do NOT call loadPolicies — simulates missing directory
      const result = await emptySvc.isAuthorized(
        makeToken(['platform-engineers']),
        makeEndpoint('GET', 'prod'),
        '10.0.0.1',
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('no policies loaded')
    })
  })
})
