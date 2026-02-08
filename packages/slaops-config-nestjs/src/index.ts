import { configFromEnv, setConfigForProcess } from "@slaops/config";

export function nestConfigOptions() {
  return {
    isGlobal: true,
    validate: (env: Record<string, any>) => {
      // parse once using the same logic
      const cfg = configFromEnv(env as any);

      // if this is process.env, ensure everyone else sees the same instance
      if (env === process.env) setConfigForProcess(cfg);

      return cfg; // Nest stores this in its config store
    },
  };
}