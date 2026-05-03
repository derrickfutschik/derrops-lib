// packages/config/src/from-env.ts
import { loadConfig } from './load'
import type { AppConfigEnv } from './schema'

let cached: AppConfigEnv | undefined

export function configFromEnv(env: Record<string, unknown> = process.env): AppConfigEnv {
  // cache only when using the real process.env
  if (env === process.env) {
    if (!cached) cached = loadConfig(env)
    return cached
  }

  // no caching for custom env objects (tests)
  return loadConfig(env)
}

export function setConfigForProcess(config: AppConfigEnv) {
  cached = config
}

export function resetConfigForTests() {
  cached = undefined
  onCacheReset?.()
}

/** Returns the overridden config env when set (for tests). Otherwise undefined. */
export function getConfigInputOverride(): AppConfigEnv | undefined {
  return cached
}

/** Registers callback for when config cache should be invalidated. Used by config module. */
export function setOnCacheReset(fn: () => void) {
  onCacheReset = fn
}

let onCacheReset: (() => void) | undefined
