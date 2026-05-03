export type SecretValue = {
  /** Raw secret string (or JSON string for structured secrets). */
  value: string
  /** ISO 8601 timestamp of when this value was last fetched or cached. */
  fetchedAt: string
  /** True if served from the local cache rather than the backing store. */
  fromCache: boolean
}

export class SecretStoreError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'ACCESS_DENIED' | 'STORE_UNAVAILABLE' | 'INVALID_FORMAT',
    /** The store-internal identifier (path within the store, not the full URI). */
    public readonly secretId: string,
  ) {
    super(message)
    this.name = 'SecretStoreError'
  }
}

/**
 * Cloud-agnostic secret store interface.
 *
 * Implementations receive the store-internal path (the part after scheme://)
 * rather than the full secret URI. The registry strips the scheme before
 * dispatching to the correct store.
 */
export interface SecretStore {
  /** Retrieve a secret by its store-internal path. */
  getSecret(secretId: string): Promise<SecretValue>

  /**
   * Retrieve a single field from a structured (JSON) secret.
   * Throws SecretStoreError with code 'INVALID_FORMAT' if the secret is not
   * valid JSON or does not contain the requested field.
   */
  getSecretField(secretId: string, field: string): Promise<SecretValue>

  /** Check whether a secret exists without fetching its value. */
  hasSecret(secretId: string): Promise<boolean>

  /** List available secret IDs, or null if the backend does not support listing. */
  listSecrets?(): Promise<string[] | null>

  /** Proactively warm the local cache for a set of secret paths. */
  prefetch?(secretIds: string[]): Promise<void>
}
