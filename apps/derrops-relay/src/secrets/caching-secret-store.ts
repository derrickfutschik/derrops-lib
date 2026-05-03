import type { SecretStore, SecretValue } from './secret-store'

type CacheEntry = { value: SecretValue; expiresAt: number }

/**
 * Wraps any SecretStore with an in-process TTL cache.
 * The cache is process-local and does not survive restarts — intentional,
 * as stale secrets are a bigger risk than the latency of a re-fetch.
 */
export class CachingSecretStore implements SecretStore {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly ttlMs: number

  constructor(
    private readonly inner: SecretStore,
    ttlSeconds: number,
  ) {
    this.ttlMs = ttlSeconds * 1000
  }

  private cacheKey(secretId: string, field?: string): string {
    return field ? `${secretId}#${field}` : secretId
  }

  private get(key: string): SecretValue | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }
    return { ...entry.value, fromCache: true }
  }

  private set(key: string, value: SecretValue): void {
    if (this.ttlMs <= 0) return
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }

  async getSecret(secretId: string): Promise<SecretValue> {
    const key = this.cacheKey(secretId)
    const cached = this.get(key)
    if (cached) return cached
    const value = await this.inner.getSecret(secretId)
    this.set(key, value)
    return value
  }

  async getSecretField(secretId: string, field: string): Promise<SecretValue> {
    const key = this.cacheKey(secretId, field)
    const cached = this.get(key)
    if (cached) return cached
    const value = await this.inner.getSecretField(secretId, field)
    this.set(key, value)
    return value
  }

  async hasSecret(secretId: string): Promise<boolean> {
    const cached = this.get(this.cacheKey(secretId))
    if (cached) return true
    return this.inner.hasSecret(secretId)
  }

  async listSecrets(): Promise<string[] | null> {
    return this.inner.listSecrets?.() ?? null
  }

  async prefetch(secretIds: string[]): Promise<void> {
    await Promise.all(
      secretIds.map((id) =>
        this.getSecret(id).catch(() => {
          /* ignore prefetch failures */
        }),
      ),
    )
  }
}
