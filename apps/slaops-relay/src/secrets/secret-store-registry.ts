import { SecretStore, SecretValue } from './secret-store'
import { CachingSecretStore } from './caching-secret-store'
import { VaultSecretStore } from './vault-secret-store'
import { AwsSecretsManagerStore } from './aws-secrets-manager-store'
import { AzureKeyVaultStore } from './azure-key-vault-store'
import { GcpSecretManagerStore } from './gcp-secret-manager-store'
import { env } from '../env'

export type SecretStoreFactory = (environment: NodeJS.ProcessEnv) => SecretStore

/**
 * Minimal logging interface accepted by the registry.
 * The proxy service supplies an adapter wrapping the NestJS Logger.
 */
export type SecretLogger = {
  debug(obj: object): void
  info(obj: object): void
  warn(obj: object): void
  error(obj: object): void
}

/**
 * Parse a secret URI into its constituent parts.
 *
 * Format: scheme://path[#field]
 *
 * Examples:
 *   aws-secretsmanager://arn:aws:secretsmanager:us-east-1:123:secret:name
 *     → { scheme: 'aws-secretsmanager', path: 'arn:aws:...', field: undefined }
 *   vault://vault.myco.com/secret/data/key#password
 *     → { scheme: 'vault', path: 'vault.myco.com/secret/data/key', field: 'password' }
 */
export function parseSecretUri(secretUri: string): {
  scheme: string
  path: string
  field?: string
} {
  const schemeSep = secretUri.indexOf('://')
  if (schemeSep === -1) {
    throw new Error(`Invalid secret URI — missing '://': ${secretUri}`)
  }
  const scheme = secretUri.slice(0, schemeSep)
  const rest = secretUri.slice(schemeSep + 3) // everything after ://

  const hashIdx = rest.indexOf('#')
  const path = hashIdx === -1 ? rest : rest.slice(0, hashIdx)
  const field = hashIdx === -1 ? undefined : rest.slice(hashIdx + 1) || undefined

  if (!scheme) throw new Error(`Invalid secret URI — empty scheme: ${secretUri}`)
  if (!path) throw new Error(`Invalid secret URI — empty path: ${secretUri}`)

  return { scheme, path, field }
}

/**
 * Registry of SecretStore implementations keyed by URI scheme.
 *
 * Secrets are addressed by full URI: {{aws-secretsmanager://arn:...}}
 * The scheme selects the backend. Multiple schemes can be active in a single request.
 *
 * One CachingSecretStore-wrapped instance is created per scheme on first use
 * and reused for the lifetime of the process.
 */
export class SecretStoreRegistry {
  private readonly factories = new Map<string, SecretStoreFactory>()
  private readonly instances = new Map<string, SecretStore>()

  register(scheme: string, factory: SecretStoreFactory): void {
    if (this.factories.has(scheme)) {
      throw new Error(`SecretStore scheme '${scheme}' is already registered`)
    }
    this.factories.set(scheme, factory)
  }

  private getInstance(scheme: string): SecretStore {
    const existing = this.instances.get(scheme)
    if (existing) return existing

    const factory = this.factories.get(scheme)
    if (!factory) {
      throw new Error(
        `No SecretStore registered for URI scheme '${scheme}'. ` +
          `Available: ${[...this.factories.keys()].join(', ')}`,
      )
    }
    const store = factory(process.env)
    const ttl = env.relay.secretCacheTtlS
    const wrapped = ttl > 0 ? new CachingSecretStore(store, ttl) : store
    this.instances.set(scheme, wrapped)
    return wrapped
  }

  /**
   * Resolve a secret URI to its value.
   *
   * The URI scheme selects the backend. A #field fragment selects a JSON
   * field from the secret value. Emits structured log events via the optional logger.
   */
  async resolve(
    secretUri: string,
    jobId?: string,
    logger?: SecretLogger,
  ): Promise<SecretValue> {
    const { scheme, path, field } = parseSecretUri(secretUri)
    const store = this.getInstance(scheme)

    logger?.debug({
      event: 'secret.resolve.start',
      secretScheme: scheme,
      secretPath: path,
      ...(field ? { field } : {}),
      jobId,
    })

    try {
      const result = field
        ? await store.getSecretField(path, field)
        : await store.getSecret(path)

      if (result.fromCache) {
        logger?.debug({
          event: 'secret.resolve.cache_hit',
          secretScheme: scheme,
          secretPath: path,
          ...(field ? { field } : {}),
          fromCache: true,
          jobId,
        })
      } else {
        logger?.debug({
          event: 'secret.resolve.cache_miss',
          secretScheme: scheme,
          secretPath: path,
          ...(field ? { field } : {}),
          fromCache: false,
          jobId,
        })
      }

      logger?.info({
        event: 'secret.resolve.success',
        secretScheme: scheme,
        secretPath: path,
        ...(field ? { field } : {}),
        fromCache: result.fromCache,
        jobId,
      })

      return result
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? 'STORE_UNAVAILABLE'
      const message = err instanceof Error ? err.message : String(err)
      logger?.error({
        event: 'secret.resolve.error',
        secretScheme: scheme,
        secretPath: path,
        ...(field ? { field } : {}),
        errorCode: code,
        errorMessage: message,
        jobId,
      })
      throw err
    }
  }
}

/** Singleton registry used throughout the application. */
export const secretStoreRegistry = new SecretStoreRegistry()

// Register built-in backends
secretStoreRegistry.register('vault', envArg => new VaultSecretStore(envArg))
secretStoreRegistry.register('aws-secretsmanager', envArg => new AwsSecretsManagerStore(envArg))
secretStoreRegistry.register('azure-keyvault', envArg => new AzureKeyVaultStore(envArg))
secretStoreRegistry.register('gcp-secretsmanager', envArg => new GcpSecretManagerStore(envArg))
