import { SecretStore } from './secret-store'
import { CachingSecretStore } from './caching-secret-store'
import { EnvSecretStore } from './env-secret-store'
import { env } from '../env'

export type SecretStoreFactory = (environment: NodeJS.ProcessEnv) => SecretStore

/**
 * Registry of available SecretStore implementations.
 * Built-in backends are pre-registered. Customers can register custom
 * implementations before calling createRelayApp() / bootstrap().
 */
export class SecretStoreRegistry {
  private readonly factories = new Map<string, SecretStoreFactory>()

  register(name: string, factory: SecretStoreFactory): void {
    if (this.factories.has(name)) {
      throw new Error(`SecretStore backend '${name}' is already registered`)
    }
    this.factories.set(name, factory)
  }

  /**
   * Create the active SecretStore from RELAY_SECRET_BACKEND.
   * Wraps the result in CachingSecretStore unless RELAY_SECRET_CACHE_TTL_S=0.
   */
  create(environment: NodeJS.ProcessEnv = process.env): SecretStore {
    const backendName = env.relay.secretBackend
    const factory = this.factories.get(backendName)
    if (!factory) {
      throw new Error(
        `SecretStore backend '${backendName}' is not registered. ` +
          `Available: ${[...this.factories.keys()].join(', ')}`,
      )
    }
    const store = factory(environment)
    const ttl = env.relay.secretCacheTtlS
    return ttl > 0 ? new CachingSecretStore(store, ttl) : store
  }
}

/** Singleton registry used throughout the application. */
export const secretStoreRegistry = new SecretStoreRegistry()

// Register built-in backends
secretStoreRegistry.register('env', envArg => new EnvSecretStore(envArg))
