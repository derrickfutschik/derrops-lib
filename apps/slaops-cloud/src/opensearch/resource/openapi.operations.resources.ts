import { config } from '@slaops/config';

import type { Indices_PutIndexTemplate_Request } from '@opensearch-project/opensearch/api/indices/putIndexTemplate';
import type { Ingest_PutPipeline_Request } from '@opensearch-project/opensearch/api/ingest/putPipeline';

export const OPENAPI_OPS_INDEX_PATTERNS = [config['opensearch.index.openapi.operations']];
export const OPENAPI_OPS_TEMPLATE_NAME = 'openapi-operations-template';
export const OPENAPI_OPS_PIPELINE_ID = 'openapi-operation-pipeline';
export const OPENAPI_OPS_WRITE_ALIAS = 'openapi-operations';


export const openapiOperationsTemplate: Indices_PutIndexTemplate_Request = {
    name: OPENAPI_OPS_TEMPLATE_NAME,
    body: {
        index_patterns: OPENAPI_OPS_INDEX_PATTERNS,
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
                    apiId: { type: 'keyword' },
                    apiVersion: { type: 'keyword' },
                    title: { type: 'text' },

                    method: { type: 'keyword' },

                    path: {
                        type: 'text',
                        fields: {
                            keyword: { type: 'keyword' },
                            auto: { type: 'text', analyzer: 'autocomplete', search_analyzer: 'standard' },
                        },
                    },

                    operationId: {
                        type: 'text',
                        fields: {
                            keyword: { type: 'keyword' },
                            auto: { type: 'text', analyzer: 'autocomplete', search_analyzer: 'standard' },
                        },
                    },

                    summary: { type: 'text' },
                    description: { type: 'text' },
                    tags: { type: 'keyword' },

                    parameters: {
                        type: 'nested',
                        properties: {
                            name: { type: 'keyword' },
                            in: { type: 'keyword' },
                            required: { type: 'boolean' },
                            type: { type: 'keyword' },
                            description: { type: 'text' },
                        },
                    },

                    requestContentTypes: { type: 'keyword' },
                    responseCodes: { type: 'keyword' },
                    security: { type: 'keyword' },
                    servers: { type: 'keyword' },

                    searchText: { type: 'text' },

                    rawSpec: { type: 'object', enabled: false },
                },
            },
        },
    },
};

export const openapiOperationPipeline: Ingest_PutPipeline_Request = {
    id: OPENAPI_OPS_PIPELINE_ID,
    body: {
        description: 'Build searchText for openapi operation documents',
        processors: [
            {
                set: {
                    field: 'searchText',
                    // keep it simple; you can expand this later
                    value: '{{method}} {{path}} {{operationId}} {{summary}} {{description}}' as unknown as Record<string, any>,
                },
            },
        ],
    },
};
