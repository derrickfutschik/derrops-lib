import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

// Multi-field mapping: text for full-text search, .keyword for exact-match filtering and sorting.
const kw = { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } } as const

/** Index template for OaServerDocument — one doc per server entry per spec version. */
export const oaspecServerTemplate: Indices_PutIndexTemplate_Request = {
  name: 'oaspec-server-template',
  body: {
    index_patterns: ['*--oaspec--server'],
    template: {
      mappings: {
        dynamic: 'false',
        properties: {
          id: kw,
          apiId: kw,
          specId: kw,
          tenantId: kw,
          version: kw,
          serverIndex: { type: 'integer' },
          latest: { type: 'boolean' },
          indexedAt: { type: 'date' },
          rawUrl: kw,
          description: { type: 'text' },
          scheme: kw,
          hostTemplate: kw,
          hostShape: kw,
          dnsSuffix: kw,
          fixedLabelsText: { type: 'text' },
          varLabelsText: { type: 'text' },
          basePath: kw,
          variablesText: { type: 'text' },
        },
      },
    },
  },
}
