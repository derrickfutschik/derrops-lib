---
sidebar_position: 1
slug: /
---

# Code

This section surfaces **README** documentation from across the SLAOps platform monorepo—apps and packages—so you can browse module and component docs in one place.

Content is copied at build time from each area’s `README.md` via `scripts/copy-code-readmes.mjs` (run automatically by `pnpm start` and `pnpm build`). To refresh: `pnpm docs:prepare`.

## Apps

- **[slaops-cloud](/code/apps/slaops-cloud)** — NestJS backend API
- **[slaops-portal](/code/apps/slaops-portal)** — React web portal
- **slaops-cloud modules**: [OpenAPI Indexer](/code/apps/slaops-cloud-openapi-indexer), [OpenAPI Search](/code/apps/slaops-cloud-openapi-search)

## Packages

- **[slaops-config](/code/packages/slaops-config)** — Configuration
- **[slaops-private](/code/packages/slaops-private)** — Core types and utilities
- **[slaops-public](/code/packages/slaops-public)** — Shared utilities
- **[slaops-client](/code/packages/slaops-client)** — Base HTTP client
- **[slaops-client-nodejs-axios](/code/packages/slaops-client-nodejs-axios)** — Axios client
- **[slaops-backend](/code/packages/slaops-backend)** — Amplify backend
- **[slaops-infra](/code/packages/slaops-infra)** — CDK infrastructure
- **[slaops-test](/code/packages/slaops-test)** — Integration tests

Use the sidebar to open each README.
