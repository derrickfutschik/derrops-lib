# OpenSearch module

This module **owns OpenSearch assets and settings** for the derrops-cloud app: it provides the AWS OpenSearch Serverless client and manages index templates and ingest pipelines according to the project convention.

## Convention

- **Configuration** – All endpoint, index names, template names, and pipeline ids come from `@derrops/config` (e.g. `opensearch.endpoint`, `opensearch.index.*`, `opensearch.template.*`, `opensearch.pipeline.*`). No hardcoded asset names.
- **Definitions** – Index templates live under `resource/indices/`, ingest pipelines under `resource/pipelines/`. Each is registered in the corresponding `index.ts` and applied by the migration.
- **Migration** – A single command applies (upserts) all defined templates and pipelines. Run it when deploying or when adding or changing assets:

To migrate the Opensearch resources, run the following command:

```bash
pnpm --filter @derrops/cloud run opensearch:migrate:dev
```

## What the module provides

- **`Client`** and **`TypescriptOSProxyClient`** – Injected OpenSearch clients (AWS SigV4, config-driven endpoint).
- **`OpenSearchService`** – Runs the migration (template and pipeline upserts). Other features that need OpenSearch should import `OpenSearchModule` and use the exported client or this service.

Adding new index templates or ingest pipelines means adding definitions under `resource/indices/` or `resource/pipelines/`, registering them in the barrel `index.ts`, and re-running the migrate command; no code changes are required in the service beyond the existing convention.
