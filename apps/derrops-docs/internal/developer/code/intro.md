---
sidebar_position: 1
slug: /
description: Root page for the Developer focused code documentation.
---

# Purpose

Implementation detail documentation for the Derrops platform monorepo, developer day-to-day focused.

# Code

This section surfaces **README** documentation from across the Derrops platform monorepo—apps and packages—so you can browse module and component docs in one place.

Content is copied at build time from each area’s `README.md` via `scripts/copy-code-readmes.mjs` (run automatically by `pnpm start` and `pnpm build`). To refresh: `pnpm docs:prepare`.

## Apps

- **[derrops-cloud](/internal/developer/apps/derrops-cloud)** — NestJS backend API (service registry, cloud relay control plane)
- **[derrops-portal](/internal/developer/apps/derrops-portal)** — React web portal
- **[derrops-relay](/internal/developer/apps/derrops-relay)** — Stateless HTTP proxy relay agent
- **[derrops-aegis](/internal/developer/apps/derrops-aegis)** — Customer-controlled session delegation broker
- **derrops-cloud modules**: [OpenAPI Indexer](/internal/developer/apps/derrops-cloud/openapi-indexer), [OpenAPI Search](/internal/developer/apps/derrops-cloud/openapi-search)

## Packages

- **[derrops-config](/internal/developer/packages/derrops-config)** — Configuration
- **[derrops-private](/internal/developer/packages/derrops-private)** — Core types and utilities
- **[derrops-public](/internal/developer/packages/derrops-public)** — Shared utilities
- **[derrops-client-nodejs-axios](/internal/developer/packages/derrops-client-nodejs-axios)** — Axios client
- **[derrops-backend](/internal/developer/packages/derrops-backend)** — Amplify backend
- **[derrops-infra](/internal/developer/packages/derrops-infra)** — CDK infrastructure
- **[derrops-test](/internal/developer/packages/derrops-test)** — Integration tests

Use the sidebar to open each README.
