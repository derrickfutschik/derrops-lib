// packages/config/src/from-env.ts
import type { AppConfig } from "./schema";
import { loadConfig } from "./load";

let cached: AppConfig | undefined;

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
    // cache only when using the real process.env
    if (env === process.env) {
        if (!cached) cached = loadConfig(env);
        return cached;
    }

    // no caching for custom env objects (tests)
    return loadConfig(env);
}

export function setConfigForProcess(config: AppConfig) {
    cached = config;
}

export function resetConfigForTests() {
    cached = undefined;
}
