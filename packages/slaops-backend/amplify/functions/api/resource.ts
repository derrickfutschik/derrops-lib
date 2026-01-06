import { defineFunction } from '@aws-amplify/backend';

export const api = defineFunction({
  name: 'slaops-api',
  entry: '../../../../apps/slaops-cloud/src/lambda.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20,
  // TODO use ZOD environment schema for this
  environment: {
    NODE_ENV: 'production',
    // Database connection will be set from infrastructure stack outputs
    DB_HOST: '', // Set via backend configuration
    DB_PORT: '5432',
    DB_NAME: 'slaops',
    DB_SSL: 'true',
    DB_LOGGING: 'false',
  },
});
