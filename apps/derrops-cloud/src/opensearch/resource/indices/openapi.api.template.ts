import { config } from '@derrops/config'

import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

/**
 * Index template for OpenApiIndexDocument (spec-level OpenAPI index).
 * Used by the OpenAPI directory indexer and search.
 */
export const apiIndexTemplate: Indices_PutIndexTemplate_Request = {
  name: config['opensearch.template.openapi.apis'],
  body: {
    index_patterns: [config['opensearch.index.openapi.apis']],
    template: {
      settings: {
        analysis: {
          filter: {
            edge_ngram_filter: { type: 'edge_ngram', min_gram: 2, max_gram: 20 },
          },
          analyzer: {
            autocomplete: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'edge_ngram_filter'],
            },
          },
        },
      },
      mappings: {
        dynamic: 'false',
        properties: {
          id: { type: 'keyword' },
          provider: { type: 'keyword' },
          serviceName: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
              auto: { type: 'text', analyzer: 'autocomplete', search_analyzer: 'standard' },
            },
          },
          version: { type: 'keyword' },
          specVersion: { type: 'keyword' },
          title: { type: 'text' },
          description: { type: 'text' },
          termsOfService: { type: 'keyword' },
          contact: {
            type: 'object',
            properties: {
              name: { type: 'keyword' },
              email: { type: 'keyword' },
              url: { type: 'keyword' },
            },
          },
          license: {
            type: 'object',
            properties: {
              name: { type: 'keyword' },
              url: { type: 'keyword' },
            },
          },
          servers: {
            type: 'nested',
            properties: {
              url: { type: 'keyword' },
              description: { type: 'text' },
            },
          },
          tags: { type: 'keyword' },
          operationStats: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              byMethod: { type: 'object', enabled: false },
              methods: { type: 'keyword' },
              pathPrefixes: { type: 'keyword' },
              operationIds: { type: 'keyword' },
            },
          },
          sampleOperations: {
            type: 'nested',
            properties: {
              method: { type: 'keyword' },
              path: { type: 'keyword' },
              operationId: { type: 'keyword' },
              summary: { type: 'text' },
            },
          },
          paths: { type: 'keyword' },
          operationSearchText: { type: 'text' },
          searchText: { type: 'text' },
          externalDocs: {
            type: 'object',
            properties: {
              url: { type: 'keyword' },
              description: { type: 'text' },
            },
          },
          s3Location: {
            type: 'object',
            properties: {
              bucket: { type: 'keyword' },
              key: { type: 'keyword' },
            },
          },
          indexedAt: { type: 'date' },
          updatedAt: { type: 'date' },
          fileSize: { type: 'long' },
          fileFormat: { type: 'keyword' },
        },
      },
    },
  },
}
