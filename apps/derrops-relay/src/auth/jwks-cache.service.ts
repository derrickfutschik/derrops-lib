import { Injectable, Logger } from '@nestjs/common'

/** Cache TTL for JWKS fetched from a remote endpoint (milliseconds). */
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000

/** Timeout for JWKS fetch requests (milliseconds). */
const JWKS_FETCH_TIMEOUT_MS = 10_000

interface JwksCacheEntry {
  keys: object[]
  fetchedAt: number
}

@Injectable()
export class JwksCacheService {
  private readonly logger = new Logger(JwksCacheService.name)
  private readonly cache = new Map<string, JwksCacheEntry>()

  async getKeys(jwksUrl: string): Promise<object[]> {
    const cached = this.cache.get(jwksUrl)
    const now = Date.now()

    if (cached && now - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
      return cached.keys
    }

    this.logger.debug(`Fetching JWKS from ${jwksUrl}`)
    const keys = await this.fetchKeys(jwksUrl)
    this.cache.set(jwksUrl, { keys, fetchedAt: now })
    return keys
  }

  private async fetchKeys(jwksUrl: string): Promise<object[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), JWKS_FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(jwksUrl, { signal: controller.signal }).finally(() =>
        clearTimeout(timeout),
      )

      if (!response.ok) {
        throw new Error(`JWKS fetch returned HTTP ${response.status}`)
      }

      const body = (await response.json()) as { keys?: object[] }
      if (!Array.isArray(body?.keys)) {
        throw new Error('JWKS response did not contain a `keys` array')
      }

      return body.keys
    } catch (err) {
      this.logger.error(`Failed to fetch JWKS from ${jwksUrl}: ${(err as Error).message}`)
      throw err
    }
  }

  /** Evict a cached entry (e.g. on JWT verification failure to trigger a refresh). */
  invalidate(jwksUrl: string): void {
    this.cache.delete(jwksUrl)
  }
}
