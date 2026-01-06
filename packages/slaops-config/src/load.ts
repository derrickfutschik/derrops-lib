import { ConfigSchema, type AppConfig } from "./schema";

/**
 * Pure function.
 * - No side effects
 * - No caching
 * - No globals
 * - Deterministic
 */
export function loadConfig(
  env: NodeJS.ProcessEnv,
): AppConfig {
  const parsed = ConfigSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment variables:\n${issues}`,
    );
  }

  return parsed.data;
}


// export const load = (env: NodeJS.ProcessEnv = process.env) => makeConfig(loadEnv(env))