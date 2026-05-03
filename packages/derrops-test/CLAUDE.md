# @derrops/test

Cross-package integration test harness. Has dev dependencies on all Derrops packages so you can write tests that exercise multiple packages together without manually wiring up dependencies.

**Status**: Private (not published to npm)

## When to use

Write here when a test needs to import from more than one `@derrops/*` package, or when verifying how packages interact end-to-end.

## Test location

- `src/__tests__/` for integration tests
- `.test.ts` suffix anywhere in `src/`

## Commands

```bash
pnpm run test        # Vitest
pnpm run test:watch  # Vitest watch
pnpm run build       # Build with tsup
pnpm run dev         # Watch mode
```
