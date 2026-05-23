import { matches } from './matcher'
import type { Condition, RequestContext } from './types'

function ctx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    user: { id: 'u1', authenticated: true, roles: [] },
    tenant: { id: 't1', plan: 'pro', allowlist: [] },
    request: { method: 'GET', headers: {}, bodyBytes: 0 },
    url: {
      raw: 'https://api.example.com/v1',
      scheme: 'https',
      host: 'api.example.com',
      port: 443,
      path: '/v1',
      query: {},
    },
    host: {
      resolvedIps: [],
      isIp: false,
      isLocalhost: false,
      isPrivateNetwork: false,
      isLinkLocal: false,
      isLoopback: false,
      isMulticast: false,
      inTenantAllowlist: true,
    },
    ...overrides,
  }
}

describe('matches', () => {
  describe('exact equality', () => {
    it('matches a string field', () => {
      expect(matches({ 'request.method': 'GET' }, ctx())).toBe(true)
    })

    it('does not match a wrong value', () => {
      expect(matches({ 'request.method': 'POST' }, ctx())).toBe(false)
    })

    it('matches a boolean field', () => {
      expect(matches({ 'host.isIp': false }, ctx())).toBe(true)
      expect(matches({ 'host.isIp': true }, ctx())).toBe(false)
    })

    it('matches a number field', () => {
      expect(matches({ 'url.port': 443 }, ctx())).toBe(true)
      expect(matches({ 'url.port': 80 }, ctx())).toBe(false)
    })

    it('returns false for an undefined path', () => {
      const cond: Condition = { 'request.nonexistent': 'value' }
      expect(matches(cond, ctx())).toBe(false)
    })
  })

  describe('.in operator', () => {
    it('matches when value is in the list', () => {
      expect(matches({ 'request.method.in': ['GET', 'HEAD'] }, ctx())).toBe(true)
    })

    it('does not match when value is absent from the list', () => {
      expect(matches({ 'request.method.in': ['POST', 'PUT'] }, ctx())).toBe(false)
    })

    it('works with scheme strings', () => {
      expect(matches({ 'url.scheme.in': ['https', 'wss'] }, ctx())).toBe(true)
    })
  })

  describe('.lte operator', () => {
    it('matches when value is below the threshold', () => {
      expect(matches({ 'request.bodyBytes.lte': 1000 }, ctx())).toBe(true)
    })

    it('matches when value equals the threshold', () => {
      expect(matches({ 'request.bodyBytes.lte': 0 }, ctx())).toBe(true)
    })

    it('does not match when value exceeds the threshold', () => {
      const c = ctx()
      c.request = { method: 'POST', headers: {}, bodyBytes: 2000 }
      expect(matches({ 'request.bodyBytes.lte': 1000 }, c)).toBe(false)
    })
  })

  describe('.gte operator', () => {
    it('matches when value meets or exceeds the threshold', () => {
      expect(matches({ 'request.bodyBytes.gte': 0 }, ctx())).toBe(true)
    })

    it('does not match when value falls below the threshold', () => {
      expect(matches({ 'request.bodyBytes.gte': 1 }, ctx())).toBe(false)
    })
  })

  describe('.matches glob operator', () => {
    it('matches an exact hostname', () => {
      expect(matches({ 'url.host.matches': ['api.example.com'] }, ctx())).toBe(true)
    })

    it('matches via wildcard', () => {
      expect(matches({ 'url.host.matches': ['*.example.com'] }, ctx())).toBe(true)
    })

    it('is case-insensitive', () => {
      expect(matches({ 'url.host.matches': ['API.EXAMPLE.COM'] }, ctx())).toBe(true)
    })

    it('does not match an unrelated host', () => {
      const c = ctx()
      c.url = { ...c.url, host: 'evil.com' }
      expect(matches({ 'url.host.matches': ['*.example.com', 'api.other.com'] }, c)).toBe(false)
    })

    it('matches any pattern in the list', () => {
      expect(matches({ 'url.host.matches': ['evil.com', 'api.example.com'] }, ctx())).toBe(true)
    })
  })

  describe('exists operator', () => {
    it('exists: true passes for a defined field', () => {
      expect(matches({ 'request.method': { exists: true } }, ctx())).toBe(true)
    })

    it('exists: false passes for an undefined field', () => {
      const cond: Condition = { 'request.unknownField': { exists: false } }
      expect(matches(cond, ctx())).toBe(true)
    })

    it('exists: true fails for an undefined field', () => {
      const cond: Condition = { 'request.unknownField': { exists: true } }
      expect(matches(cond, ctx())).toBe(false)
    })
  })

  describe('logical combinators', () => {
    it('all: requires every sub-condition to pass', () => {
      const cond: Condition = {
        all: [{ 'request.method': 'GET' }, { 'url.scheme': 'https' }],
      }
      expect(matches(cond, ctx())).toBe(true)

      const c = ctx()
      c.request = { method: 'POST', headers: {}, bodyBytes: 0 }
      expect(matches(cond, c)).toBe(false)
    })

    it('any: passes when at least one sub-condition matches', () => {
      const cond: Condition = {
        any: [{ 'request.method': 'POST' }, { 'request.method': 'GET' }],
      }
      expect(matches(cond, ctx())).toBe(true)
    })

    it('any: fails when no sub-condition matches', () => {
      const cond: Condition = {
        any: [{ 'request.method': 'POST' }, { 'request.method': 'DELETE' }],
      }
      expect(matches(cond, ctx())).toBe(false)
    })

    it('not: inverts the result', () => {
      expect(matches({ not: { 'request.method': 'POST' } }, ctx())).toBe(true)
      expect(matches({ not: { 'request.method': 'GET' } }, ctx())).toBe(false)
    })

    it('nests combinators', () => {
      const cond: Condition = {
        all: [
          { 'url.scheme': 'https' },
          { not: { 'host.isIp': true } },
          { any: [{ 'request.method': 'GET' }, { 'request.method': 'POST' }] },
        ],
      }
      expect(matches(cond, ctx())).toBe(true)
    })
  })

  describe('multiple keys in a plain condition object', () => {
    it('requires all keys to match (implicit AND)', () => {
      const cond: Condition = { 'request.method': 'GET', 'url.scheme': 'https' }
      expect(matches(cond, ctx())).toBe(true)

      const c = ctx()
      c.url = { ...c.url, scheme: 'http' }
      expect(matches(cond, c)).toBe(false)
    })
  })
})
