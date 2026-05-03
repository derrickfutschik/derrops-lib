import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate'

// Multi-field mapping: text for full-text search, .keyword for exact-match filtering and sorting.
const kw = { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } } as const

/** Index template for OaSpecDocument — one doc per spec version per tenant. */
export const oaspecSpecTemplate: Indices_PutIndexTemplate_Request = {
  name: 'oaspec-spec-template',
  body: {
    index_patterns: ['*--oaspec--spec'],
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
          id: kw,
          apiId: kw,
          tenantId: kw,
          version: kw,
          specVersion: kw,
          latest: { type: 'boolean' },
          indexedAt: { type: 'date' },
          updatedAt: { type: 'date' },
          title: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword', ignore_above: 256 },
              auto: { type: 'text', analyzer: 'autocomplete', search_analyzer: 'standard' },
            },
          },
          description: { type: 'text' },
          termsOfService: kw,
          contactText: { type: 'text' },
          licenseText: { type: 'text' },
          externalDocsText: { type: 'text' },
          tagsText: { type: 'text' },
          operationCount: { type: 'integer' },
          serverCount: { type: 'integer' },
          parameterCount: { type: 'integer' },
          modelCount: { type: 'integer' },
          s3Bucket: kw,
          s3Key: kw,
          fileSize: { type: 'long' },
          fileFormat: kw,
        },
      },
    },
  },
}
