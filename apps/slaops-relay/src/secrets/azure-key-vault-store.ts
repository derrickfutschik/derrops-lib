import { SecretClient } from '@azure/keyvault-secrets'
import { DefaultAzureCredential } from '@azure/identity'
import { SecretStore, SecretStoreError, SecretValue } from './secret-store'

/**
 * Azure Key Vault secret store.
 *
 * URI format: azure-keyvault://vault-host/secrets/secret-name[/version]
 *
 * The store receives the path portion (everything after azure-keyvault://).
 * Examples:
 *   myvault.vault.azure.net/secrets/api-key
 *   myvault.vault.azure.net/secrets/api-key/abc123def456
 *
 * Omitting the version resolves the current (latest enabled) version.
 *
 * Authentication: Azure DefaultAzureCredential — tries Managed Identity,
 * then environment variables (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
 * AZURE_TENANT_ID), then Azure CLI, then workload identity.
 *
 * Requires @azure/keyvault-secrets and @azure/identity (included in package.json).
 */
export class AzureKeyVaultStore implements SecretStore {
  private readonly clients = new Map<string, SecretClient>()

  constructor(_environment: NodeJS.ProcessEnv = process.env) {}

  private parsePath(secretId: string): {
    vaultHost: string
    secretName: string
    version?: string
  } {
    // Expected: host/secrets/name or host/secrets/name/version
    const segments = secretId.split('/')
    if (segments.length < 3 || segments[1] !== 'secrets') {
      throw new SecretStoreError(
        `Invalid Azure Key Vault path '${secretId}' — expected: vault-host/secrets/name[/version]`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    return {
      vaultHost: segments[0],
      secretName: segments[2],
      version: segments[3] || undefined,
    }
  }

  private getClient(vaultHost: string): SecretClient {
    const existing = this.clients.get(vaultHost)
    if (existing) return existing
    const client = new SecretClient(`https://${vaultHost}`, new DefaultAzureCredential())
    this.clients.set(vaultHost, client)
    return client
  }

  async getSecret(secretId: string): Promise<SecretValue> {
    const { vaultHost, secretName, version } = this.parsePath(secretId)
    try {
      const client = this.getClient(vaultHost)
      const secret = await client.getSecret(secretName, version ? { version } : undefined)

      if (secret.value === undefined) {
        throw new SecretStoreError(`Azure secret '${secretId}' has no value`, 'NOT_FOUND', secretId)
      }
      return { value: secret.value, fetchedAt: new Date().toISOString(), fromCache: false }
    } catch (err: unknown) {
      if (err instanceof SecretStoreError) throw err
      const statusCode = (err as { statusCode?: number })?.statusCode ?? 0
      if (statusCode === 404) {
        throw new SecretStoreError(`Azure secret not found: '${secretId}'`, 'NOT_FOUND', secretId)
      }
      if (statusCode === 403 || statusCode === 401) {
        throw new SecretStoreError(
          `Azure access denied for secret '${secretId}'`,
          'ACCESS_DENIED',
          secretId,
        )
      }
      throw new SecretStoreError(
        `Azure Key Vault error for '${secretId}': ${err instanceof Error ? err.message : String(err)}`,
        'STORE_UNAVAILABLE',
        secretId,
      )
    }
  }

  async getSecretField(secretId: string, field: string): Promise<SecretValue> {
    const { value, fetchedAt } = await this.getSecret(secretId)
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new SecretStoreError(
        `Azure secret '${secretId}' is not valid JSON`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    if (typeof parsed !== 'object' || parsed === null || !(field in (parsed as object))) {
      throw new SecretStoreError(
        `Field '${field}' not found in Azure secret '${secretId}'`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    const fieldValue = (parsed as Record<string, unknown>)[field]
    return { value: String(fieldValue), fetchedAt, fromCache: false }
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
