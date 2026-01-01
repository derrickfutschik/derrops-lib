import { loadConfig } from "@slaops/slaops-config";

export function nestConfigOptions() {
  return {
    isGlobal: true,
    validate: (env: Record<string, any>) => loadConfig(env as any),
  };
}