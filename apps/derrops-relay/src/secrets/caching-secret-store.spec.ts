import { CachingSecretStore } from './caching-secret-store'
import type { SecretStore, SecretValue } from './secret-store'

function mockStore(value: string): { store: SecretStore; calls: number } {
  const state = { calls: 0 }
  const store: SecretStore = {
    getSecret: jest.fn(async () => {
      state.calls++
      return { value, fetchedAt: new Date().toISOString(), fromCache: false } satisfies SecretValue
    }),
    getSecretField: jest.fn(async (id: string, field: string) => {
      state.calls++
      const parsed = JSON.parse(value) as Record<string, unknown>
      return {
        value: String(parsed[field]),
        fetchedAt: new Date().toISOString(),
        fromCache: false,
      } satisfies SecretValue
    }),
    hasSecret: jest.fn(async () => true),
    listSecrets: jest.fn(async () => ['secret/key']),
  }
  return { store, calls: state.calls }
}

describe('CachingSecretStore', () => {
  describe('with a positive TTL', () => {
    it('returns the inner store value on the first call', async () => {
      const { store } = mockStore('my-value')
      const cached = new CachingSecretStore(store, 60)
      const result = await cached.getSecret('secret/key')
      expect(result.value).toBe('my-value')
    })

    it('serves subsequent calls from cache (fromCache: true)', async () => {
      const { store } = mockStore('my-value')
      const cached = new CachingSecretStore(store, 60)
      await cached.getSecret('secret/key')
      const second = await cached.getSecret('secret/key')
      expect(second.fromCache).toBe(true)
      expect(store.getSecret).toHaveBeenCalledTimes(1)
    })

    it('caches getSecretField independently per field', async () => {
      const { store } = mockStore(JSON.stringify({ a: '1', b: '2' }))
      const cached = new CachingSecretStore(store, 60)
      await cached.getSecretField('secret/key', 'a')
      await cached.getSecretField('secret/key', 'a')
      expect(store.getSecretField).toHaveBeenCalledTimes(1)
    })

    it('uses separate cache keys for different fields', async () => {
      const { store } = mockStore(JSON.stringify({ a: '1', b: '2' }))
      const cached = new CachingSecretStore(store, 60)
      await cached.getSecretField('secret/key', 'a')
      await cached.getSecretField('secret/key', 'b')
      expect(store.getSecretField).toHaveBeenCalledTimes(2)
    })

    it('hasSecret returns true without an extra getSecret call when cached', async () => {
      const { store } = mockStore('my-value')
      const cached = new CachingSecretStore(store, 60)
      await cached.getSecret('secret/key')
      const found = await cached.hasSecret('secret/key')
      expect(found).toBe(true)
    })

    it('hasSecret delegates to inner store when not cached', async () => {
      const { store } = mockStore('my-value')
      const cached = new CachingSecretStore(store, 60)
      await cached.hasSecret('secret/key')
      expect(store.hasSecret).toHaveBeenCalledWith('secret/key')
    })
  })

  describe('with TTL = 0 (cache disabled)', () => {
    it('calls the inner store on every request', async () => {
      const { store } = mockStore('my-value')
      const cached = new CachingSecretStore(store, 0)
      await cached.getSecret('secret/key')
      await cached.getSecret('secret/key')
      expect(store.getSecret).toHaveBeenCalledTimes(2)
    })

    it('never returns fromCache: true', async () => {
      const { store } = mockStore('my-value')
      const cached = new CachingSecretStore(store, 0)
      await cached.getSecret('secret/key')
      const second = await cached.getSecret('secret/key')
      expect(second.fromCache).toBe(false)
    })
  })

  describe('expired cache entries', () => {
    it('re-fetches when the cache entry has expired', async () => {
      jest.useFakeTimers()
      const { store } = mockStore('my-value')
      const cached = new CachingSecretStore(store, 1) // 1-second TTL
      await cached.getSecret('secret/key')
      jest.advanceTimersByTime(1001)
      await cached.getSecret('secret/key')
      expect(store.getSecret).toHaveBeenCalledTimes(2)
      jest.useRealTimers()
    })
  })

  describe('listSecrets', () => {
    it('delegates to the inner store', async () => {
      const { store } = mockStore('v')
      const cached = new CachingSecretStore(store, 60)
      const list = await cached.listSecrets()
      expect(list).toEqual(['secret/key'])
    })
  })

  describe('prefetch', () => {
    it('warms the cache for each secret ID', async () => {
      const { store } = mockStore('my-value')
      const cached = new CachingSecretStore(store, 60)
      await cached.prefetch(['secret/key'])
      const second = await cached.getSecret('secret/key')
      expect(second.fromCache).toBe(true)
      expect(store.getSecret).toHaveBeenCalledTimes(1)
    })

    it('does not throw when a prefetch fails', async () => {
      const failingStore: SecretStore = {
        getSecret: jest.fn(async () => {
          throw new Error('unavailable')
        }),
        getSecretField: jest.fn(),
        hasSecret: jest.fn(async () => false),
      }
      const cached = new CachingSecretStore(failingStore, 60)
      await expect(cached.prefetch(['secret/key'])).resolves.toBeUndefined()
    })
  })
})
