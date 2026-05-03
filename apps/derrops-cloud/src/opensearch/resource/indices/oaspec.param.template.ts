import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

// Multi-field mapping: text for full-text search, .keyword for exact-match filtering and sorting.
const kw = { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } } as const

/** Index template for OaParamDocument — one doc per unique parameter per spec version. */
export const oaspecParamTemplate: Indices_PutIndexTemplate_Request = {
  name: 'oaspec-param-template',
  body: {
    index_patterns: ['*--oaspec--param'],
    template: {
      mappings: {
        dynamic: 'false',
        properties: {
          id: kw,
          apiId: kw,
          specId: kw,
          tenantId: kw,
          version: kw,
          latest: { type: 'boolean' },
          indexedAt: { type: 'date' },
          name: kw,
          location: kw,
          required: { type: 'boolean' },
          deprecated: { type: 'boolean' },
          description: { type: 'text' },
          schemaType: kw,
          schemaFormat: kw,
          exampleText: { type: 'text' },
          operationIdsText: { type: 'text' },
        },
      },
    },
  },
}
