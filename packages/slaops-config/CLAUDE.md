# @slaops/config

Zod-validated, type-safe configuration management for the SLAOps platform. Provides a `config` singleton with dot-notation key access. All application code must use this module — never `process.env` directly.

## API

```typescript
import { config } from '@slaops/config'

config['app.port']
config['db.host']
config['opensearch.endpoint']
config['opensearch.index'](entity) // function — generates index name
```

See `src/schema.ts` for all available keys.

### Exported functions

| Export                        | Purpose                                               |
| ----------------------------- | ----------------------------------------------------- |
| `config`                      | Pre-built singleton (uses `process.env`)              |
| `ConfigSchema`                | Zod schema for raw env vars                           |
| `loadConfig(env)`             | Pure — validate and load from a custom env object     |
| `configFromEnv(env?)`         | Cached loader (cache keyed to `process.env` only)     |
| `makeConfig(cfg?)`            | Transforms raw env object into structured `AppConfig` |
| `setConfigForProcess(config)` | Override the cached config (useful in tests)          |
| `resetConfigForTests()`       | Clear cached config for test isolation                |

## Adding a new config property

All configurable values — limits, sizes, timeouts, names, prefixes, defaults — must live here as named properties. Never use magic numbers or hardcoded strings in application code.

**When to add a property:**

- Any numeric literal that isn't `0`, `1`, or an obvious mathematical constant
- Any string representing a name, key, prefix, suffix, or identifier
- Any timeout, limit, threshold, size, or default value

**How to add** (`src/config.ts`):

```typescript
return {
  // ...existing properties

  /** Maximum number of retries for failed API requests */
  'app.api.max-retries': 3,
}
```

Rules:

- Use plain values (not `input.*`) unless the value genuinely varies per environment
- `input.*` is reserved for true environment variables (credentials, endpoints, region)
- Every property **must** have a `/** JSDoc comment */` describing what it controls

**Consuming the property:**

```typescript
import { config } from '@slaops/config'
const maxRetries = config['app.api.max-retries']
```

## Testing with custom config

```typescript
import { loadConfig, resetConfigForTests } from '@slaops/config'

const testConfig = loadConfig({
  NODE_ENV: 'test',
  DB_NAME: 'test_db',
  // ... other required vars
})

afterEach(() => {
  resetConfigForTests()
})
```

## OpenSearch index names

**Never construct OpenSearch index names manually.** All index naming conventions (prefix, environment suffix, tenant segment) are centralised in `src/config.ts`. Always use the provided config functions:

```typescript
import { config } from '@slaops/config'

// OASpec indices — {prefix}--{env}--{tenantId}--oaspec--{entity}
config['opensearch.oaspec.index']('t-abc123', 'spec') // slaops--dev--t-abc123--oaspec--spec
config['opensearch.oaspec.search-alias']('t-abc123', 'spec') // slaops--dev--t-abc123--oaspec--spec--search

// Legacy indices
config['opensearch.index.openapi.apis'] // slaops-openapi-apis-dev
config['opensearch.index.openapi.operations']
```

Do **not** define local `oaspecIndex()` or similar helpers in feature modules — they will miss the environment segment and diverge from the canonical naming.

## Commands

```bash
pnpm run build   # Build with tsup (ESM + CJS)
pnpm run dev     # Watch mode
```
