import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

// Multi-field mapping: text for full-text search, .keyword for exact-match filtering and sorting.
const kw = { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } } as const

/** Index template for OaModelDocument — one doc per schema model per spec version. */
export const oaspecModelTemplate: Indices_PutIndexTemplate_Request = {
  name: 'oaspec-model-template',
  body: {
    index_patterns: ['*--oaspec--model'],
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
          description: { type: 'text' },
          schemaType: kw,
          propertiesText: { type: 'text' },
          operationIdsText: { type: 'text' },
          usedInText: { type: 'text' },
        },
      },
    },
  },
}
