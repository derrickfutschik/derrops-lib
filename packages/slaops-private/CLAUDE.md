# @slaops/private

Foundation package for the SLAOps platform. Contains core TypeScript types, interfaces, shared constants/enums, and base utility functions used by every other package. Has no dependencies — it is the base of the build graph.

**Status**: Private (not published to npm)

## What belongs here

- Platform-wide TypeScript types and interfaces
- Shared constants and enums
- Base utility functions needed by multiple packages

## Test utilities

The `src/test-utils/openapi-loader.ts` module provides helpers for loading OpenAPI specs from the `test-resources/` directory (auto-installed via `postinstall`, gitignored):

```typescript
import {
  loadOpenApiSpec,
  listAvailableSpecs,
  findSpecs,
} from '@slaops/private/src/test-utils/openapi-loader'

const spec        = await loadOpenApiSpec('github.com', 'api.github.com', '1.1.4')
const githubSpecs = await findSpecs('github')
```

See [test-resources/README.md](../../test-resources/README.md) for the full spec catalogue.

## Commands

```bash
pnpm run build       # Build with tsup (ESM + CJS + .d.ts)
pnpm run dev         # Watch mode
pnpm run test        # Vitest
pnpm run test:watch  # Vitest watch
```
