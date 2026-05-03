import { SecretStore, SecretStoreError, SecretValue } from './secret-store'

/**
 * Reads secrets from process.env.
 * Each secret ID maps directly to an environment variable name.
 * Supports single-level JSON field extraction via getSecretField().
 */
export class EnvSecretStore implements SecretStore {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async getSecret(secretId: string): Promise<SecretValue> {
    const raw = this.env[secretId]
    if (raw === undefined) {
      throw new SecretStoreError(
        `Environment variable '${secretId}' is not set`,
        'NOT_FOUND',
        secretId,
      )
    }
    return { value: raw, fetchedAt: new Date().toISOString(), fromCache: false }
  }

  async getSecretField(secretId: string, field: string): Promise<SecretValue> {
    const { value, ...meta } = await this.getSecret(secretId)
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new SecretStoreError(
        `Secret '${secretId}' is not valid JSON`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    if (typeof parsed !== 'object' || parsed === null || !(field in (parsed as object))) {
      throw new SecretStoreError(
        `Field '${field}' not found in secret '${secretId}'`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    const fieldValue = (parsed as Record<string, unknown>)[field]
    return { value: String(fieldValue), fetchedAt: meta.fetchedAt, fromCache: false }
  }

  async hasSecret(secretId: string): Promise<boolean> {
    return this.env[secretId] !== undefined
  }

  async listSecrets(): Promise<string[]> {
    return Object.keys(this.env)
  }
}
