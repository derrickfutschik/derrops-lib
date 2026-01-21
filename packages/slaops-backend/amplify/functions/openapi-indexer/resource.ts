import { defineFunction } from '@aws-amplify/backend';

export const openapiIndexer = defineFunction({
  name: 'openapi-indexer',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 1024,
  runtime: 20,
  environment: {
    OPENSEARCH_ENDPOINT: '', // Set via backend configuration from infra exports
    OPENSEARCH_INDEX_NAME: 'slaops-openapis',
    DEBUG: 'false',
  },
});
