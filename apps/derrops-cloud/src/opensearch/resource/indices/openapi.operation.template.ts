import { config } from '@derrops/config'

import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

export const operationIndexTemplate: Indices_PutIndexTemplate_Request = {
  name: config['opensearch.template.openapi.operations'],
  body: {
    index_patterns: [config['opensearch.index.openapi.operations']],
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
          apiId: { type: 'keyword' },
          apiVersion: { type: 'keyword' },
          title: { type: 'text' },

          method: { type: 'keyword' },

          path: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
              auto: { type: 'text', analyzer: 'autocomplete', search_analyzer: 'standard' },
            },
          },

          operationId: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
              auto: { type: 'text', analyzer: 'autocomplete', search_analyzer: 'standard' },
            },
          },

          summary: { type: 'text' },
          description: { type: 'text' },
          tags: { type: 'keyword' },

          parameters: {
            type: 'nested',
            properties: {
              name: { type: 'keyword' },
              in: { type: 'keyword' },
              required: { type: 'boolean' },
              type: { type: 'keyword' },
              description: { type: 'text' },
            },
          },

          requestContentTypes: { type: 'keyword' },
          responseCodes: { type: 'keyword' },
          security: { type: 'keyword' },
          servers: { type: 'keyword' },

          searchText: { type: 'text' },

          rawSpec: { type: 'object', enabled: false },
        },
      },
    },
  },
}
