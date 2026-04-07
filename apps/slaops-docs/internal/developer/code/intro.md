---
sidebar_position: 1
slug: /
description: Root page for the Developer focused code documentation.
---

# Purpose

Implementation detail documentation for the SLAOps platform monorepo, developer day-to-day focused.

# Code

This section surfaces **README** documentation from across the SLAOps platform monorepo—apps and packages—so you can browse module and component docs in one place.

Content is copied at build time from each area’s `README.md` via `scripts/copy-code-readmes.mjs` (run automatically by `pnpm start` and `pnpm build`). To refresh: `pnpm docs:prepare`.

## Apps

- **[slaops-cloud](/internal/developer/apps/slaops-cloud)** — NestJS backend API (service registry, cloud relay control plane)
- **[slaops-portal](/internal/developer/apps/slaops-portal)** — React web portal
- **[slaops-relay](/internal/developer/apps/slaops-relay)** — Stateless HTTP proxy relay agent
- **[slaops-aegis](/internal/developer/apps/slaops-aegis)** — Customer-controlled session delegation broker
- **slaops-cloud modules**: [OpenAPI Indexer](/internal/developer/apps/slaops-cloud/openapi-indexer), [OpenAPI Search](/internal/developer/apps/slaops-cloud/openapi-search)

## Packages

- **[slaops-config](/internal/developer/packages/slaops-config)** — Configuration
- **[slaops-private](/internal/developer/packages/slaops-private)** — Core types and utilities
- **[slaops-public](/internal/developer/packages/slaops-public)** — Shared utilities
- **[slaops-client-nodejs-axios](/internal/developer/packages/slaops-client-nodejs-axios)** — Axios client
- **[slaops-backend](/internal/developer/packages/slaops-backend)** — Amplify backend
- **[slaops-infra](/internal/developer/packages/slaops-infra)** — CDK infrastructure
- **[slaops-test](/internal/developer/packages/slaops-test)** — Integration tests

Use the sidebar to open each README.
