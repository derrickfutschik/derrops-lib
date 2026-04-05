import { buildContext } from './cedar-context.builder'
import type { CognitoTokenPayload, RequestedEndpoint } from './cedar-entity.builder'

const NOW_EPOCH = Math.floor(Date.now() / 1000)

const BASE_TOKEN: CognitoTokenPayload = {
  sub:       'user-1',
  amr:       ['mfa', 'software_totp'],
  auth_time: NOW_EPOCH - 300,
  iat:       NOW_EPOCH - 300,
  exp:       NOW_EPOCH + 3300,
  client_id: 'portal-client-abc',
}

const BASE_ENDPOINT: RequestedEndpoint = {
  host:        'payments.internal',
  method:      'GET',
  path:        '/v1/orders/{id}',
  relayId:     'relay-01',
  environment: 'prod',
}

describe('buildContext', () => {
  it('derives mfaVerified=true when amr contains "mfa"', () => {
    const ctx = buildContext(BASE_TOKEN, BASE_ENDPOINT, '10.0.0.5')
    expect(ctx.mfaVerified).toBe(true)
  })

  it('derives mfaVerified=false when amr is password-only', () => {
    const token = { ...BASE_TOKEN, amr: ['pwd'] }
    const ctx = buildContext(token, BASE_ENDPOINT, '10.0.0.5')
    expect(ctx.mfaVerified).toBe(false)
    expect(ctx.authMethod).toBe('PASSWORD')
  })

  it('derives authMethod=SOFTWARE_TOTP for software_totp amr', () => {
    const ctx = buildContext(BASE_TOKEN, BASE_ENDPOINT, '10.0.0.5')
    expect(ctx.authMethod).toBe('SOFTWARE_TOTP')
  })

  it('derives authMethod=EXTERNAL_IDP for federated tokens', () => {
    const token = { ...BASE_TOKEN, amr: ['external-provider'] }
    const ctx = buildContext(token, BASE_ENDPOINT, '10.0.0.5')
    expect(ctx.authMethod).toBe('EXTERNAL_IDP')
  })

  it('computes tokenAgeSeconds and tokenExpiresInSeconds correctly', () => {
    const ctx = buildContext(BASE_TOKEN, BASE_ENDPOINT, '10.0.0.5')
    expect(ctx.tokenAgeSeconds).toBeGreaterThanOrEqual(300)
    expect(ctx.tokenExpiresInSeconds).toBeLessThanOrEqual(3300)
    expect(ctx.tokenExpiresInSeconds).toBeGreaterThan(0)
  })

  it('populates ipAddress, relayId, environment from request', () => {
    const ctx = buildContext(BASE_TOKEN, BASE_ENDPOINT, '192.168.1.1')
    expect(ctx.ipAddress).toBe('192.168.1.1')
    expect(ctx.relayId).toBe('relay-01')
    expect(ctx.environment).toBe('prod')
  })

  it('defaults environment to "default" when not provided', () => {
    const endpoint = { ...BASE_ENDPOINT, environment: undefined }
    const ctx = buildContext(BASE_TOKEN, endpoint, '0.0.0.0')
    expect(ctx.environment).toBe('default')
  })

  it('sets tokenNbf to tokenIat when nbf is absent', () => {
    const token = { ...BASE_TOKEN, nbf: undefined }
    const ctx = buildContext(token, BASE_ENDPOINT, '0.0.0.0')
    expect(ctx.tokenNbf).toBe(ctx.tokenIat)
  })

  it('timeOfDayHour is 0–23', () => {
    const ctx = buildContext(BASE_TOKEN, BASE_ENDPOINT, '0.0.0.0')
    expect(ctx.timeOfDayHour).toBeGreaterThanOrEqual(0)
    expect(ctx.timeOfDayHour).toBeLessThanOrEqual(23)
  })
})
