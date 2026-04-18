import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

/** Index template for OaServerDocument — one doc per server entry per spec version. */
export const oaspecServerTemplate: Indices_PutIndexTemplate_Request = {
  name: 'oaspec-server-template',
  body: {
    index_patterns: ['slaops--*--oaspec--server'],
    template: {
      mappings: {
        dynamic: 'false',
        properties: {
          id: { type: 'keyword' },
          apiId: { type: 'keyword' },
          specId: { type: 'keyword' },
          tenantId: { type: 'keyword' },
          version: { type: 'keyword' },
          serverIndex: { type: 'integer' },
          latest: { type: 'boolean' },
          indexedAt: { type: 'date' },
          rawUrl: { type: 'text' },
          description: { type: 'text' },
          scheme: { type: 'keyword' },
          hostTemplate: { type: 'keyword' },
          hostShape: { type: 'keyword' },
          dnsSuffix: { type: 'keyword' },
          fixedLabelsText: { type: 'text' },
          varLabelsText: { type: 'text' },
          basePath: { type: 'keyword' },
          variablesText: { type: 'text' },
        },
      },
    },
  },
}
