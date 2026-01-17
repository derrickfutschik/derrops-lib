import { z } from "zod";


// TODO - do not have the schema on the environment variables, but rather on the AppConfig interface.
export const ConfigSchema = z.object({
  NODE_ENV: z.enum(["dev", "test", "prod"]).default("dev"),
  PORT: z.coerce.number().default(3000),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_SSL: z.string().optional(),
  DB_LOGGING: z.string().optional(),

  APP_VERSION: z.string().min(1).default("0.0.1"), // should come from package.json
});

export type AppConfigEnv = z.infer<typeof ConfigSchema>;

