# @slaops/client

Base HTTP client for the SLAOps platform. Provides the `SlaOpsClient` base class and abstractions that platform-specific client implementations extend (e.g. `slaops-client-nodejs-axios`).

**Status**: Public (published to npm)  
**Depends on**: `@slaops/private`

## Key exports

- `SlaOpsClient` — base class
- Client configuration types
- Event sending logic
- HTTP client abstractions

## Commands

```bash
pnpm run build       # Build with tsup (ESM + CJS + .d.ts)
pnpm run dev         # Watch mode
pnpm run test        # Vitest
pnpm run test:watch  # Vitest watch
```
