import { z } from 'zod'

// TODO - there should be no default variables and rather manage this through environment variables somehwo

export const ConfigSchema = z.object({
  VITE_APP_AUTH_MOCK_ENABLED: z.coerce.boolean(),

  NODE_VERSION: z.number().optional(),

  NODE_ENV: z.enum(['local', 'test', 'dev', 'staging', 'prod']),
  PORT: z.coerce.number().optional(),

  DB_NAME: z.string().min(1).optional(),
  DB_SSL: z.string().optional().optional(),
  DB_LOGGING: z.string().optional(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().optional(),
  DB_DATABASE: z.string().min(1).optional(),
  DB_SCHEMA: z.string().min(1).optional(),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  APP_NAME: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.string().min(1).default('SLAOps'),
  ),
  APP_VERSION: z.string().min(1).optional(), // should come from package.json

  AWS_REGION: z.string().min(1),
  AWS_ACCOUNT_ID: z.string().min(1),

  AWS_COGNITO_USER_POOL_ID: z.string().min(1).optional(),
  // AWS_COGNITO_USER_POOL_CLIENT_ID: z.string().min(1),
  // AWS_COGNITO_IDENTITY_POOL_ID: z.string().min(1),

  AWS_LAMBDA_RUNTIME: z.string().min(1).optional(),
  AWS_LAMBDA_MEMORY: z.number().min(1).optional(),

  OPENSEARCH_INDEX_PREFIX: z.string().min(1).optional(),
  OPENSEARCH_INDEX_SUFFIX: z.string().min(1).optional(),

  OPENSEARCH_ENDPOINT: z.string().min(1),
  DYNAMODB_ENDPOINT: z.string().min(1),
  AWS_S3_ENDPOINT: z.string().min(1).optional(),

  APP_DEBUG: z.boolean().optional(),
})

export type AppConfigEnv = z.infer<typeof ConfigSchema>

export type ConfigInput = z.input<typeof ConfigSchema>
export type Config = z.output<typeof ConfigSchema>
