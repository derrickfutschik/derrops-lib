import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

/** Index template for OaModelDocument — one doc per schema model per spec version. */
export const oaspecModelTemplate: Indices_PutIndexTemplate_Request = {
  name: 'oaspec-model-template',
  body: {
    index_patterns: ['slaops--*--oaspec--model'],
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
          description: { type: 'text' },
          schemaType: { type: 'keyword' },
          propertiesText: { type: 'text' },
          operationIdsText: { type: 'text' },
          usedInText: { type: 'text' },
        },
      },
    },
  },
}
