import { z } from "zod";


// TODO - there should be no default variables and rather manage this through environment variables somehwo

export const ConfigSchema = z.object({

  NODE_ENV: z.enum(["dev", "test", "prod"]).default("dev"),
  PORT: z.coerce.number().default(3000),

  DB_NAME: z.string().min(1),
  DB_SSL: z.string().optional().default("false"),
  DB_LOGGING: z.string().optional().default("false"),
  DB_HOST: z.string().min(1).default("192.168.7.224"),
  DB_PORT: z.coerce.number().default(5432),
  DB_DATABASE: z.string().min(1).default("slaops"),
  DB_SCHEMA: z.string().min(1).default("public"),
  DB_USERNAME: z.string().min(1).default("postgres"),
  DB_PASSWORD: z.string().min(1).default("postgres"),

  APP_NAME: z.string().min(1).default("SLAOps"),
  APP_VERSION: z.string().min(1).default("0.0.1"), // should come from package.json

  AWS_REGION: z.string().min(1).default("ap-southeast-2"),

  OPENSEARCH_INDEX_PREFIX: z.string().min(1).default("slaops-"),
  OPENSEARCH_INDEX_NAME: z.string().min(1).default("opensearch-index"),
  OPENSEARCH_ENDPOINT: z.string().min(1).default("http://192.168.7.224:9200"),

});

export type AppConfigEnv = z.infer<typeof ConfigSchema>;

