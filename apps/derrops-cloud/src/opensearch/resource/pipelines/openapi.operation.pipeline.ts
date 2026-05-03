import type { Ingest_PutPipeline_Request } from '@opensearch-project/opensearch/api/ingest/putPipeline'

import { config } from '@derrops/config'

export const operationPipeline: Ingest_PutPipeline_Request = {
  id: config['opensearch.pipeline.openapi.operations'],
  body: {
    description: 'Build searchText for openapi operation documents',
    processors: [
      {
        set: {
          field: 'searchText',
          // keep it simple; you can expand this later
          value:
            '{{method}} {{path}} {{operationId}} {{summary}} {{description}}' as unknown as Record<
              string,
              any
            >,
        },
      },
    ],
  },
}
