import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

/** Index template for OaOperationDocument — one doc per HTTP operation per spec version. */
export const oaspecOperationTemplate: Indices_PutIndexTemplate_Request = {
  name: 'oaspec-operation-template',
  body: {
    index_patterns: ['slaops--*--oaspec--operation'],
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
          method: { type: 'keyword' },
          path: { type: 'keyword' },
          operationId: { type: 'keyword' },
          summary: { type: 'text' },
          description: { type: 'text' },
          tagsText: { type: 'text' },
          deprecated: { type: 'boolean' },
          pathKey: { type: 'keyword' },
          parameterIdsText: { type: 'text' },
          requestModelId: { type: 'keyword' },
          responseModelIdsText: { type: 'text' },
        },
      },
    },
  },
}
