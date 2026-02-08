import { defineFunction } from '@aws-amplify/backend'
// Type-only import for IDE navigation (doesn't trigger strict type-checking of slaops-cloud)

import { config } from '@slaops/config'

export const openapiIndexer = defineFunction({
  name: config['app.opneapi-indexer.name'],
  entry: '../../../../apps/slaops-cloud/src/indexer-lambda.ts',
  timeoutSeconds: config['aws.lambda.timeout.seconds'],
  memoryMB: config['aws.lambda.memory'],
  runtime: config['node.version'] as 18 | 20 | 22,
  // Use Stack Outputs to transform to environment variables
  // TODO use zod schema for this (may need all the env vars)
  environment: {
    OPENSEARCH_ENDPOINT: config['opensearch.endpoint'],
    OPENSEARCH_INDEX_NAME: config['opensearch.index.openapi.apis'],
    DEBUG: 'false',
  },
})
