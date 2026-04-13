import { SecretStore, SecretStoreError, SecretValue } from './secret-store'

/**
 * HashiCorp Vault secret store.
 *
 * URI format: vault://host/mount/path  (KV v1 or KV v2)
 *
 * The store receives the path portion of the URI (everything after vault://).
 * First segment = host, remaining segments = Vault API path.
 *
 * KV v2: vault://vault.myco.com/secret/data/db-password
 *   API: GET https://vault.myco.com/v1/secret/data/db-password
 *   Response envelope: { data: { data: { key: value } } }
 *
 * KV v1: vault://vault.myco.com/kv/db-password
 *   API: GET https://vault.myco.com/v1/kv/db-password
 *   Response envelope: { data: { key: value } }
 *
 * Authentication: token via RELAY_VAULT_TOKEN environment variable.
 * AppRole and Kubernetes auth can be added as future auth methods.
 *
 * For structured secrets (JSON objects), use getSecretField() to extract
 * individual fields, or use the #field URI fragment via the registry.
 *
 * No external packages required — uses Node.js built-in fetch.
 */
export class VaultSecretStore implements SecretStore {
  private readonly token: string | undefined
  private readonly namespace: string | undefined

  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {
    this.token = environment.RELAY_VAULT_TOKEN
    this.namespace = environment.RELAY_VAULT_NAMESPACE
  }

  /**
   * Parse the store-internal path into a Vault API URL and key path.
   * Input: "vault.myco.com/secret/data/db-password"
   * Output: { baseUrl: "https://vault.myco.com", apiPath: "secret/data/db-password" }
   */
  private parsePath(secretId: string): { baseUrl: string; apiPath: string } {
    const slashIdx = secretId.indexOf('/')
    if (slashIdx === -1) {
      throw new SecretStoreError(
        `Invalid Vault path '${secretId}' — expected format: host/mount/path`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    const host = secretId.slice(0, slashIdx)
    const apiPath = secretId.slice(slashIdx + 1)

    // Use https unless the host is a loopback address (local dev)
    const isLocal = host.startsWith('127.') || host === 'localhost' || host.startsWith('::1')
    const scheme = isLocal ? 'http' : 'https'
    return { baseUrl: `${scheme}://${host}`, apiPath }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.token) headers['X-Vault-Token'] = this.token
    if (this.namespace) headers['X-Vault-Namespace'] = this.namespace
    return headers
  }

  /**
   * Determine if this is a KV v2 path by checking for the /data/ segment.
   * KV v2 paths look like: mount/data/key
   */
  private isKvV2(apiPath: string): boolean {
    const segments = apiPath.split('/')
    return segments.length >= 2 && segments[1] === 'data'
  }

  /**
   * Extract the secret value from a Vault API response.
   * Handles both KV v1 ({ data: {...} }) and KV v2 ({ data: { data: {...} } }) envelopes.
   * Returns the nested data object as a JSON string (or raw string if it's a single value).
   */
  private extractSecretData(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseBody: any,
    apiPath: string,
    secretId: string,
  ): string {
    const isV2 = this.isKvV2(apiPath)
    const data = isV2 ? responseBody?.data?.data : responseBody?.data

    if (data === undefined || data === null) {
      throw new SecretStoreError(
        `No data found in Vault response for '${secretId}'`,
        'NOT_FOUND',
        secretId,
      )
    }

    return typeof data === 'string' ? data : JSON.stringify(data)
  }

  async getSecret(secretId: string): Promise<SecretValue> {
    const { baseUrl, apiPath } = this.parsePath(secretId)
    const url = `${baseUrl}/v1/${apiPath}`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(10_000),
      })
    } catch (err: unknown) {
      throw new SecretStoreError(
        `Vault unreachable at '${baseUrl}': ${err instanceof Error ? err.message : String(err)}`,
        'STORE_UNAVAILABLE',
        secretId,
      )
    }

    if (response.status === 403 || response.status === 401) {
      throw new SecretStoreError(
        `Vault access denied for '${secretId}' — check RELAY_VAULT_TOKEN`,
        'ACCESS_DENIED',
        secretId,
      )
    }

    if (response.status === 404) {
      throw new SecretStoreError(`Vault secret not found: '${secretId}'`, 'NOT_FOUND', secretId)
    }

    if (!response.ok) {
      throw new SecretStoreError(
        `Vault returned HTTP ${response.status} for '${secretId}'`,
        'STORE_UNAVAILABLE',
        secretId,
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await response.json()) as any
    const value = this.extractSecretData(body, apiPath, secretId)

    return { value, fetchedAt: new Date().toISOString(), fromCache: false }
  }

  async getSecretField(secretId: string, field: string): Promise<SecretValue> {
    const { value, ...meta } = await this.getSecret(secretId)
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new SecretStoreError(
        `Vault secret '${secretId}' is not valid JSON`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    if (typeof parsed !== 'object' || parsed === null || !(field in (parsed as object))) {
      throw new SecretStoreError(
        `Field '${field}' not found in Vault secret '${secretId}'`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    const fieldValue = (parsed as Record<string, unknown>)[field]
    return { value: String(fieldValue), fetchedAt: meta.fetchedAt, fromCache: false }
  }

  async hasSecret(secretId: string): Promise<boolean> {
    try {
      await this.getSecret(secretId)
      return true
    } catch (err) {
      if (err instanceof SecretStoreError && err.code === 'NOT_FOUND') return false
      throw err
    }
  }
}
