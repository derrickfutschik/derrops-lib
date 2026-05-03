import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import { SecretStore, SecretStoreError, SecretValue } from './secret-store'

/**
 * GCP Secret Manager secret store.
 *
 * URI format: gcp-secretsmanager://projects/project-id/secrets/name/versions/version
 *
 * The store receives the path portion (everything after gcp-secretsmanager://).
 * The path is the GCP resource name for the secret version:
 *
 *   projects/my-project-123/secrets/db-password/versions/latest
 *   projects/my-project-123/secrets/db-password/versions/5
 *
 * Authentication: Application Default Credentials (ADC).
 *   - GKE: Workload Identity (recommended)
 *   - Cloud Run / Cloud Functions: service account attached to the runtime
 *   - Local dev: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a key file,
 *     or `gcloud auth application-default login`
 *
 * Requires @google-cloud/secret-manager (included in package.json).
 */
export class GcpSecretManagerStore implements SecretStore {
  private readonly client: SecretManagerServiceClient

  constructor(_environment: NodeJS.ProcessEnv = process.env) {
    this.client = new SecretManagerServiceClient()
  }

  /**
   * Validate the path looks like a GCP secret version resource name.
   * Required format: projects/<id>/secrets/<name>/versions/<version>
   */
  private validatePath(secretId: string): void {
    const parts = secretId.split('/')
    if (
      parts.length !== 6 ||
      parts[0] !== 'projects' ||
      parts[2] !== 'secrets' ||
      parts[4] !== 'versions'
    ) {
      throw new SecretStoreError(
        `Invalid GCP secret path '${secretId}' — expected: projects/<id>/secrets/<name>/versions/<version>`,
        'INVALID_FORMAT',
        secretId,
      )
    }
  }

  async getSecret(secretId: string): Promise<SecretValue> {
    this.validatePath(secretId)

    try {
      const [version] = await this.client.accessSecretVersion({ name: secretId })

      const payload = version?.payload?.data
      if (!payload) {
        throw new SecretStoreError(
          `GCP secret '${secretId}' returned empty payload`,
          'NOT_FOUND',
          secretId,
        )
      }

      const value = Buffer.isBuffer(payload)
        ? payload.toString('utf8')
        : Buffer.from(payload as Uint8Array).toString('utf8')

      return { value, fetchedAt: new Date().toISOString(), fromCache: false }
    } catch (err: unknown) {
      if (err instanceof SecretStoreError) throw err

      const code = (err as { code?: number })?.code ?? 0
      const message = err instanceof Error ? err.message : String(err)

      if (code === 5 /* NOT_FOUND */) {
        throw new SecretStoreError(`GCP secret not found: '${secretId}'`, 'NOT_FOUND', secretId)
      }
      if (code === 7 /* PERMISSION_DENIED */ || code === 16 /* UNAUTHENTICATED */) {
        throw new SecretStoreError(
          `GCP access denied for secret '${secretId}'`,
          'ACCESS_DENIED',
          secretId,
        )
      }
      throw new SecretStoreError(
        `GCP Secret Manager error for '${secretId}': ${message}`,
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
        `GCP secret '${secretId}' is not valid JSON`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    if (typeof parsed !== 'object' || parsed === null || !(field in (parsed as object))) {
      throw new SecretStoreError(
        `Field '${field}' not found in GCP secret '${secretId}'`,
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
