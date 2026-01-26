import { defineFunction } from '@aws-amplify/backend';

import { config } from '@slaops/slaops-config';

export const api = defineFunction({
  name: config["app.api.name"],
  entry: '../../../../apps/slaops-cloud/src/lambda.ts',
  timeoutSeconds: config["aws.lambda.timeout.seconds"],
  memoryMB: config["aws.lambda.memory"],
  runtime: config["node.version"] as 18 | 20 | 22,
  // TODO use zod schema for this (may need all the env vars)
  // Database connection will be set from infrastructure stack outputs
  // Use Stack Outputs to transform to environment variables
  environment: {
    NODE_ENV: config["node.env"] as string,
    DB_HOST: config["db.host"],
    DB_PORT: config["db.port"] + "",
    DB_NAME: config["db.database"],
    DB_SSL: config["db.ssl"],
    DB_LOGGING: config["db.logging"],
  },
});
