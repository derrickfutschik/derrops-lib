import type { Ingest_PutPipeline_Request } from '@opensearch-project/opensearch/api/ingest/putPipeline'

import { config } from '@slaops/config'

/**
 * Ingest pipeline for OpenApiIndexDocument.
 * Builds a single searchText field from title, description, and operationSearchText
 * for full-text search across the API spec document.
 */
export const apiPipeline: Ingest_PutPipeline_Request = {
  id: config['opensearch.pipeline.openapi.apis'],
  body: {
    description: 'Build searchText for OpenAPI API (spec) documents',
    processors: [
      {
        set: {
          field: 'searchText',
          value: '{{title}} {{description}} {{operationSearchText}}' as unknown as Record<
            string,
            unknown
          >,
        },
      },
    ],
  },
}
