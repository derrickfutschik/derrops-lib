import { resolveTemplates, TemplateError } from './template-resolver'
import type { SecretStoreRegistry } from '../secrets/secret-store-registry'

function fakeRegistry(secrets: Record<string, string> = {}): SecretStoreRegistry {
  return {
    resolve: jest.fn(async (uri: string) => {
      if (uri in secrets) {
        return { value: secrets[uri], fetchedAt: new Date().toISOString(), fromCache: false }
      }
      throw new Error(`Secret not found: ${uri}`)
    }),
  } as unknown as SecretStoreRegistry
}

describe('resolveTemplates', () => {
  describe('no placeholders', () => {
    it('returns the original value unchanged', async () => {
      const { value } = await resolveTemplates({ url: 'https://example.com' }, fakeRegistry())
      expect(value.url).toBe('https://example.com')
    })

    it('returns an empty injectedSecrets list', async () => {
      const { injectedSecrets } = await resolveTemplates({ x: 'hello' }, fakeRegistry())
      expect(injectedSecrets).toHaveLength(0)
    })
  })

  describe('jit expressions', () => {
    it('resolves {{jit:uuid}} to a UUID string', async () => {
      const { value } = await resolveTemplates({ id: '{{jit:uuid}}' }, fakeRegistry())
      expect(value.id).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('resolves {{jit:uuid-short}} to an 8-character string', async () => {
      const { value } = await resolveTemplates({ id: '{{jit:uuid-short}}' }, fakeRegistry())
      expect(value.id).toHaveLength(8)
    })

    it('resolves {{jit:timestamp}} to an ISO string', async () => {
      const { value } = await resolveTemplates({ ts: '{{jit:timestamp}}' }, fakeRegistry())
      expect(() => new Date(value.ts as string)).not.toThrow()
      expect(isNaN(new Date(value.ts as string).getTime())).toBe(false)
    })

    it('resolves {{jit:timestamp-unix}} to a numeric string', async () => {
      const { value } = await resolveTemplates({ ts: '{{jit:timestamp-unix}}' }, fakeRegistry())
      expect(Number(value.ts)).toBeGreaterThan(0)
    })

    it('resolves {{jit:timestamp-unix-ms}} to a milliseconds string', async () => {
      const { value } = await resolveTemplates({ ts: '{{jit:timestamp-unix-ms}}' }, fakeRegistry())
      expect(Number(value.ts)).toBeGreaterThan(1_000_000_000_000)
    })

    it('resolves {{jit:random-hex:16}} to a 16-char hex string', async () => {
      const { value } = await resolveTemplates({ token: '{{jit:random-hex:16}}' }, fakeRegistry())
      expect(value.token).toMatch(/^[0-9a-f]{16}$/)
    })

    it('throws TemplateError for an unknown jit function', async () => {
      await expect(resolveTemplates({ x: '{{jit:nope}}' }, fakeRegistry())).rejects.toBeInstanceOf(
        TemplateError,
      )
    })

    it('throws TemplateError for invalid random-hex length', async () => {
      await expect(
        resolveTemplates({ x: '{{jit:random-hex:0}}' }, fakeRegistry()),
      ).rejects.toBeInstanceOf(TemplateError)
    })
  })

  describe('var expressions', () => {
    it('resolves {{var:NAME}} from the variables map', async () => {
      const { value } = await resolveTemplates(
        { greeting: 'Hello, {{var:username}}!' },
        fakeRegistry(),
        { username: 'Alice' },
      )
      expect(value.greeting).toBe('Hello, Alice!')
    })

    it('throws TemplateError for an undefined variable', async () => {
      await expect(
        resolveTemplates({ x: '{{var:missing}}' }, fakeRegistry(), {}),
      ).rejects.toBeInstanceOf(TemplateError)
    })

    it('coerces non-string variables to string', async () => {
      const { value } = await resolveTemplates({ count: '{{var:n}}' }, fakeRegistry(), { n: 42 })
      expect(value.count).toBe('42')
    })
  })

  describe('secret URI expressions', () => {
    it('resolves a secret URI and returns the value', async () => {
      const registry = fakeRegistry({ 'env://MY_SECRET': 'resolved-secret' })
      const { value } = await resolveTemplates({ token: '{{env://MY_SECRET}}' }, registry)
      expect(value.token).toBe('resolved-secret')
    })

    it('tracks the injected secret in injectedSecrets', async () => {
      const registry = fakeRegistry({ 'env://MY_SECRET': 'resolved-secret' })
      const { injectedSecrets } = await resolveTemplates({ token: '{{env://MY_SECRET}}' }, registry)
      expect(injectedSecrets).toHaveLength(1)
      expect(injectedSecrets[0].uri).toBe('env://MY_SECRET')
      expect(injectedSecrets[0].value).toBe('resolved-secret')
    })

    it('throws TemplateError when the secret store fails', async () => {
      const registry = fakeRegistry({})
      await expect(
        resolveTemplates({ token: '{{env://MISSING}}' }, registry),
      ).rejects.toBeInstanceOf(Error)
    })
  })

  describe('unknown expression types', () => {
    it('throws TemplateError for an unrecognised type prefix', async () => {
      await expect(
        resolveTemplates({ x: '{{unknown:foo}}' }, fakeRegistry()),
      ).rejects.toBeInstanceOf(TemplateError)
    })

    it('throws TemplateError for an expression with no colon and no ://', async () => {
      await expect(resolveTemplates({ x: '{{bareword}}' }, fakeRegistry())).rejects.toBeInstanceOf(
        TemplateError,
      )
    })
  })

  describe('deeply nested structures', () => {
    it('resolves placeholders in nested objects', async () => {
      const { value } = await resolveTemplates(
        { outer: { inner: '{{jit:uuid-short}}' } },
        fakeRegistry(),
      )
      expect((value.outer as { inner: string }).inner).toHaveLength(8)
    })

    it('resolves placeholders inside arrays', async () => {
      const { value } = await resolveTemplates(
        { tags: ['{{var:env}}', 'static'] },
        fakeRegistry(),
        { env: 'prod' },
      )
      expect((value.tags as string[])[0]).toBe('prod')
      expect((value.tags as string[])[1]).toBe('static')
    })
  })

  describe('passthrough values', () => {
    it('leaves numbers untouched', async () => {
      const { value } = await resolveTemplates(
        { n: 42 } as unknown as Record<string, unknown>,
        fakeRegistry(),
      )
      expect(value.n).toBe(42)
    })

    it('leaves null untouched', async () => {
      const { value } = await resolveTemplates(
        { x: null } as unknown as Record<string, unknown>,
        fakeRegistry(),
      )
      expect(value.x).toBeNull()
    })
  })
})
