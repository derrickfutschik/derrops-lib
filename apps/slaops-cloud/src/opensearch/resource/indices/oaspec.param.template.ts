import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

/** Index template for OaParamDocument — one doc per unique parameter per spec version. */
export const oaspecParamTemplate: Indices_PutIndexTemplate_Request = {
  name: 'oaspec-param-template',
  body: {
    index_patterns: ['slaops--*--oaspec--param'],
    template: {
      mappings: {
        dynamic: 'false',
        properties: {
          id: { type: 'keyword' },
          apiId: { type: 'keyword' },
          specId: { type: 'keyword' },
          tenantId: { type: 'keyword' },
          version: { type: 'keyword' },
          latest: { type: 'boolean' },
          indexedAt: { type: 'date' },
          name: { type: 'keyword' },
          location: { type: 'keyword' },
          required: { type: 'boolean' },
          deprecated: { type: 'boolean' },
          description: { type: 'text' },
          schemaType: { type: 'keyword' },
          schemaFormat: { type: 'keyword' },
          exampleText: { type: 'text' },
          operationIdsText: { type: 'text' },
        },
      },
    },
  },
}
