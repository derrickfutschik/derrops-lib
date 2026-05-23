import { evaluatePolicy } from './evaluator'
import type { Policy, RequestContext } from './types'

function ctx(): RequestContext {
  return {
    user: { id: 'u1', authenticated: true, roles: ['viewer'] },
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
      resolvedIps: ['93.184.216.34'],
      isIp: false,
      isLocalhost: false,
      isPrivateNetwork: false,
      isLinkLocal: false,
      isLoopback: false,
      isMulticast: false,
      inTenantAllowlist: true,
    },
  }
}

describe('evaluatePolicy', () => {
  describe('default fallback', () => {
    it('allows in allow-by-default mode when no rules match', () => {
      const policy: Policy = { version: '1', mode: 'allow-by-default', rules: [] }
      const result = evaluatePolicy(policy, ctx())
      expect(result.allowed).toBe(true)
      if (result.allowed) expect(result.ruleId).toBe('__default__')
    })

    it('denies in deny-by-default mode when no rules match', () => {
      const policy: Policy = { version: '1', mode: 'deny-by-default', rules: [] }
      const result = evaluatePolicy(policy, ctx())
      expect(result.allowed).toBe(false)
      if (!result.allowed) expect(result.reason).toMatch(/deny-by-default/)
    })
  })

  describe('allow rules', () => {
    it('allows when a matching allow rule is found', () => {
      const policy: Policy = {
        version: '1',
        mode: 'deny-by-default',
        rules: [
          {
            id: 'allow-gets',
            effect: 'allow',
            when: { 'request.method': 'GET' },
          },
        ],
      }
      const result = evaluatePolicy(policy, ctx())
      expect(result.allowed).toBe(true)
      if (result.allowed) expect(result.ruleId).toBe('allow-gets')
    })

    it('denies when no allow rule matches in deny-by-default mode', () => {
      const policy: Policy = {
        version: '1',
        mode: 'deny-by-default',
        rules: [
          {
            id: 'allow-posts',
            effect: 'allow',
            when: { 'request.method': 'POST' },
          },
        ],
      }
      const result = evaluatePolicy(policy, ctx())
      expect(result.allowed).toBe(false)
    })
  })

  describe('deny rules', () => {
    it('denies when a deny rule matches before any allow rule', () => {
      const policy: Policy = {
        version: '1',
        mode: 'allow-by-default',
        rules: [
          {
            id: 'deny-gets',
            effect: 'deny',
            when: { 'request.method': 'GET' },
          },
          {
            id: 'allow-all',
            effect: 'allow',
            when: { 'host.isIp': false },
          },
        ],
      }
      const result = evaluatePolicy(policy, ctx())
      expect(result.allowed).toBe(false)
      if (!result.allowed) expect(result.reason).toMatch(/deny-gets/)
    })

    it('allows when the deny rule does not match', () => {
      const policy: Policy = {
        version: '1',
        mode: 'allow-by-default',
        rules: [
          {
            id: 'deny-posts',
            effect: 'deny',
            when: { 'request.method': 'POST' },
          },
        ],
      }
      const result = evaluatePolicy(policy, ctx())
      expect(result.allowed).toBe(true)
    })
  })

  describe('hard-deny conditions', () => {
    it('hard-deny overrides a matching allow rule', () => {
      const policy: Policy = {
        version: '1',
        mode: 'allow-by-default',
        hardDeny: [{ 'host.isPrivateNetwork': true }],
        rules: [{ id: 'allow-all', effect: 'allow', when: { 'host.isIp': false } }],
      }
      const privateCtx = ctx()
      privateCtx.host = { ...privateCtx.host, isPrivateNetwork: true }

      const result = evaluatePolicy(policy, privateCtx)
      expect(result.allowed).toBe(false)
      if (!result.allowed) expect(result.reason).toMatch(/hard-deny/)
    })

    it('does not trigger hard-deny when the condition is false', () => {
      const policy: Policy = {
        version: '1',
        mode: 'allow-by-default',
        hardDeny: [{ 'host.isPrivateNetwork': true }],
        rules: [],
      }
      const result = evaluatePolicy(policy, ctx())
      expect(result.allowed).toBe(true)
    })
  })

  describe('enforcement merging', () => {
    it('merges policy defaults with the matching rule enforcement', () => {
      const policy: Policy = {
        version: '1',
        mode: 'deny-by-default',
        defaults: { timeoutMs: 5000, allowRedirects: false },
        rules: [
          {
            id: 'allow-gets',
            effect: 'allow',
            when: { 'request.method': 'GET' },
            enforce: { timeoutMs: 10000 },
          },
        ],
      }
      const result = evaluatePolicy(policy, ctx())
      expect(result.allowed).toBe(true)
      if (result.allowed) {
        expect(result.enforce.timeoutMs).toBe(10000)
        expect(result.enforce.allowRedirects).toBe(false)
      }
    })

    it('returns policy defaults when no rule enforcement is specified', () => {
      const policy: Policy = {
        version: '1',
        mode: 'deny-by-default',
        defaults: { timeoutMs: 3000 },
        rules: [
          {
            id: 'allow-gets',
            effect: 'allow',
            when: { 'request.method': 'GET' },
          },
        ],
      }
      const result = evaluatePolicy(policy, ctx())
      expect(result.allowed).toBe(true)
      if (result.allowed) expect(result.enforce.timeoutMs).toBe(3000)
    })
  })

  describe('PLATFORM_DEFAULT_POLICY scenarios', () => {
    it('blocks requests to private IP ranges (hard-deny)', () => {
      const { PLATFORM_DEFAULT_POLICY } = require('./types')
      const ssrfCtx = ctx()
      ssrfCtx.host = { ...ssrfCtx.host, isPrivateNetwork: true }
      const result = evaluatePolicy(PLATFORM_DEFAULT_POLICY, ssrfCtx)
      expect(result.allowed).toBe(false)
    })

    it('blocks requests to localhost (hard-deny)', () => {
      const { PLATFORM_DEFAULT_POLICY } = require('./types')
      const ssrfCtx = ctx()
      ssrfCtx.host = { ...ssrfCtx.host, isLocalhost: true }
      const result = evaluatePolicy(PLATFORM_DEFAULT_POLICY, ssrfCtx)
      expect(result.allowed).toBe(false)
    })

    it('allows a normal external HTTPS request', () => {
      const { PLATFORM_DEFAULT_POLICY } = require('./types')
      const result = evaluatePolicy(PLATFORM_DEFAULT_POLICY, ctx())
      expect(result.allowed).toBe(true)
    })
  })
})
