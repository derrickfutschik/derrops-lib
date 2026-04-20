import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

// Multi-field mapping: text for full-text search, .keyword for exact-match filtering and sorting.
const kw = { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } } as const

/** Index template for OaOperationDocument — one doc per HTTP operation per spec version. */
export const oaspecOperationTemplate: Indices_PutIndexTemplate_Request = {
  name: 'oaspec-operation-template',
  body: {
    index_patterns: ['*--oaspec--operation'],
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
          method: kw,
          path: kw,
          operationId: kw,
          summary: { type: 'text' },
          description: { type: 'text' },
          tagsText: { type: 'text' },
          deprecated: { type: 'boolean' },
          pathKey: kw,
          parameterIdsText: { type: 'text' },
          requestModelId: kw,
          responseModelIdsText: { type: 'text' },
        },
      },
    },
  },
}
