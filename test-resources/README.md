# Test Resources

This directory contains test resources used across the Derrops monorepo, including OpenAPI specifications from the [APIs-guru/openapi-directory](https://github.com/APIs-guru/openapi-directory).
They are not part of the Derrops platform and are not used in the production environment.
They are used for testing the Derrops platform and are not part of the Derrops platform.

## Directory Structure

```
test-resources/
├── loader.ts              # TypeScript utilities for loading test resources
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
├── openapi-directory/     # External OpenAPI specs (gitignored, auto-downloaded)
│   └── APIs/
│       ├── github.com/
│       │   └── api.github.com/
│       │       └── 1.1.4/
│       │           └── openapi.yaml
│       ├── ably.net/
│       │   └── control/
│       │       └── v1/
│       │           └── openapi.yaml
│       └── ... (many more)
└── README.md             # This file
```

## Setup

Test resources are automatically set up during `pnpm install` via the postinstall script in the root package.json. To manually refresh:

```bash
# From the repository root
pnpm run setup:test-resources --force
```

## Usage

### Import the loader

```typescript
import {
  resolveTestResource,
  resolveOpenApiSpec,
  getLatestOpenApiSpecPath,
  TEST_API_SPECS,
} from '../../../../test-resources/loader'
```

### Basic path resolution

```typescript
// Resolve any file in test-resources/
const path = resolveTestResource(
  'openapi-directory',
  'APIs',
  'github.com',
  'api.github.com',
  '1.1.4',
  'openapi.yaml',
)

// Resolve OpenAPI spec by domain, subdomain, and version
const specPath = resolveOpenApiSpec('github.com', 'api.github.com', '1.1.4')
// Returns: /absolute/path/to/test-resources/openapi-directory/APIs/github.com/api.github.com/1.1.4/openapi.yaml
```

### Using well-known specs

```typescript
import { TEST_API_SPECS } from '../../../../test-resources/loader'

// Get the Ably.net control API spec
const ablyPath = TEST_API_SPECS.ably()

// Use with your spec loader
import { loadSpec } from '../../src/openapi/parser'
const spec = await loadSpec(ablyPath)
```

### Finding specs dynamically

```typescript
// Find all specs matching a pattern
const githubSpecs = await findOpenApiSpecs('github')
// Returns: Array<{ domain, subdomain, version, path }>

// List all available domains
const domains = await listOpenApiDomains()
// Returns: ['ably.net', 'github.com', 'google.com', ...]

// Get a random spec for testing
const randomSpec = await getRandomOpenApiSpec()
if (randomSpec) {
  console.log(`Testing with ${randomSpec.domain}/${randomSpec.subdomain}@${randomSpec.version}`)
  const spec = await loadSpec(randomSpec.path)
}
```

## Example Test

Here's a complete example from [packages/Derrops-private/test/openapi/parser.test.ts](../packages/Derrops-private/test/openapi/parser.test.ts):

```typescript
import { test, expect } from '@jest/globals'
import { loadSpec } from '../../src/openapi/parser'
import { TEST_API_SPECS, resolveOpenApiSpec } from '../../../../test-resources/loader'

test('should load a spec from a file', async () => {
  const specPath = TEST_API_SPECS.ably()
  const spec = await loadSpec(specPath)
  expect(spec).toBeDefined()
  expect(spec.info).toBeDefined()
})

test('should load a spec using resolveOpenApiSpec', async () => {
  const specPath = resolveOpenApiSpec('ably.net', 'control', 'v1')
  const spec = await loadSpec(specPath)
  expect(spec).toBeDefined()
  expect(spec.info).toBeDefined()
})
```

## API Reference

### Functions

#### `resolveTestResource(...relativePath: string[]): string`

Resolve a path relative to the test-resources directory.

**Parameters:**

- `relativePath` - Path segments relative to test-resources/

**Returns:** Absolute path to the resource

**Example:**

```typescript
const path = resolveTestResource('openapi-directory', 'APIs', 'github.com')
```

---

#### `resolveOpenApiSpec(domain: string, subdomain: string, version: string, filename?: string): string`

Resolve a path to an OpenAPI spec in the openapi-directory.

**Parameters:**

- `domain` - The domain (e.g., 'github.com')
- `subdomain` - The subdomain or service name (e.g., 'api.github.com')
- `version` - The version (e.g., '1.1.4')
- `filename` - The filename (default: 'openapi.yaml')

**Returns:** Absolute path to the OpenAPI spec

**Example:**

```typescript
const path = resolveOpenApiSpec('github.com', 'api.github.com', '1.1.4')
// Returns: /path/to/test-resources/openapi-directory/APIs/github.com/api.github.com/1.1.4/openapi.yaml
```

---

#### `getLatestOpenApiSpecPath(host: string, path: string): string | null`

Resolve the path to the OpenAPI spec for the **latest version** of a given API. Version directories under `APIs/{host}/{path}/` are compared (semver-like then lexicographic); the latest is returned.

**Parameters:**

- `host` - Domain (e.g. `'github.com'`)
- `path` - Service path (e.g. `'api.github.com'`)

**Returns:** Absolute path to `openapi.yaml` for the latest version, or `null` if the API or no spec is found.

**Example:**

```typescript
const latestPath = getLatestOpenApiSpecPath('github.com', 'api.github.com')
if (latestPath) {
  const spec = await loadSpec(latestPath)
}
```

---

#### `findOpenApiSpecs(pattern?: string): Promise<SpecMetadata[]>`

Find all OpenAPI specs matching a pattern.

**Parameters:**

- `pattern` - Optional string to match against domain names (case-insensitive)

**Returns:** Promise resolving to array of spec metadata

**Type:**

```typescript
interface SpecMetadata {
  domain: string
  subdomain: string
  version: string
  path: string
}
```

**Example:**

```typescript
const githubSpecs = await findOpenApiSpecs('github')
console.log(githubSpecs)
// [
//   {
//     domain: 'github.com',
//     subdomain: 'api.github.com',
//     version: '1.1.4',
//     path: '/absolute/path/to/openapi.yaml'
//   }
// ]
```

---

#### `listOpenApiDomains(): Promise<string[]>`

List all available domains in the openapi-directory.

**Returns:** Promise resolving to array of domain names (sorted)

**Example:**

```typescript
const domains = await listOpenApiDomains()
console.log(domains) // ['ably.net', 'github.com', ...]
```

---

#### `getRandomOpenApiSpec(): Promise<SpecMetadata | null>`

Get a random OpenAPI spec for testing.

**Returns:** Promise resolving to random spec metadata or null if none found

**Example:**

```typescript
const randomSpec = await getRandomOpenApiSpec()
if (randomSpec) {
  console.log(`Testing with ${randomSpec.domain}`)
}
```

---

### Constants

#### `TEST_RESOURCES_ROOT: string`

The absolute path to the test-resources directory.

---

#### `OPENAPI_DIRECTORY_ROOT: string`

The absolute path to the openapi-directory/APIs directory.

---

#### `TEST_API_SPECS`

Common well-known specs for easy access:

```typescript
const TEST_API_SPECS = {
  ably: () => resolveOpenApiSpec('ably.net', 'control', 'v1'),
  github: () => resolveOpenApiSpec('github.com', 'api.github.com', '1.1.4'),
}
```

**Usage:**

```typescript
const ablyPath = TEST_API_SPECS.ably()
const githubPath = TEST_API_SPECS.github()
```

## Adding New Well-Known Specs

To add a commonly used spec to `TEST_API_SPECS`:

1. Verify the spec exists in openapi-directory:

   ```bash
   ls test-resources/openapi-directory/APIs/example.com/api/v1/
   ```

2. Add it to the `TEST_API_SPECS` object in [loader.ts](./loader.ts):
   ```typescript
   export const TEST_API_SPECS = {
     // ... existing specs
     myApi: () => resolveOpenApiSpec('example.com', 'api', 'v1'),
   } as const
   ```

## Notes

- The `openapi-directory/` subdirectory is **gitignored** and **excluded from IDE indexing** (via `.cursorignore` and `.claudeignore`)
- Test resources are downloaded automatically on `pnpm install`
- All paths returned by the loader utilities are **absolute paths**
- The loader uses ES modules (`import.meta.url`) to determine paths dynamically
- TypeScript support is built-in with full type definitions

## Troubleshooting

### "openapi-directory not found" error

Run the setup script:

```bash
pnpm run setup:test-resources --force
```

### "Module not found" when importing loader

Ensure you're using the correct relative path from your test file:

```typescript
// From packages/Derrops-private/test/
import { ... } from '../../../../test-resources/loader';
```

### TypeScript errors

Make sure test-resources is included in your pnpm workspace:

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'test-resources'
```
