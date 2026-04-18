import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

/** Index template for OaSpecDocument — one doc per spec version per tenant. */
export const oaspecSpecTemplate: Indices_PutIndexTemplate_Request = {
  name: 'oaspec-spec-template',
  body: {
    index_patterns: ['slaops--*--oaspec--spec'],
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
          apiId: { type: 'keyword' },
          tenantId: { type: 'keyword' },
          version: { type: 'keyword' },
          specVersion: { type: 'keyword' },
          latest: { type: 'boolean' },
          indexedAt: { type: 'date' },
          updatedAt: { type: 'date' },
          title: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
              auto: { type: 'text', analyzer: 'autocomplete', search_analyzer: 'standard' },
            },
          },
          description: { type: 'text' },
          termsOfService: { type: 'keyword' },
          contactText: { type: 'text' },
          licenseText: { type: 'text' },
          externalDocsText: { type: 'text' },
          tagsText: { type: 'text' },
          operationCount: { type: 'integer' },
          serverCount: { type: 'integer' },
          parameterCount: { type: 'integer' },
          modelCount: { type: 'integer' },
          s3Bucket: { type: 'keyword' },
          s3Key: { type: 'keyword' },
          fileSize: { type: 'long' },
          fileFormat: { type: 'keyword' },
        },
      },
    },
  },
}
