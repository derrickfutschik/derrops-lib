# @derrops/test

Integration test package for Derrops with dependencies on all other packages.

## Purpose

This package exists to provide a convenient location for writing integration tests that require multiple Derrops packages working together. Since it has dev dependencies on all other packages, you can import and test functionality across the entire monorepo without needing to set up complex dependencies.

## Features

- **All Dependencies**: Has dev dependencies on all Derrops packages (@derrops/private, @derrops/public, @derrops/client, @derrops/client-nodejs-axios)
- **Integration Testing**: Write tests that verify how packages work together
- **Convenience**: No need to manually wire up package dependencies for cross-package tests

## Installation

This package is part of the Derrops monorepo and is not published to npm.

```bash
# From monorepo root
pnpm install
```

## Usage

### Writing Integration Tests

Create test files in `src/__tests__/` or use the `.test.ts` suffix:

```typescript
import { describe, it, expect } from '@jest/globals'
import axios from 'axios'
import { attachDerropsInterceptor } from '@derrops/client-nodejs-axios'
// Import from any other Derrops package as needed

describe('My Integration Test', () => {
  it('should test cross-package functionality', () => {
    // Your test here
  })
})
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

## Development

```bash
# Build the package
pnpm run build

# Run TypeScript in watch mode
pnpm run dev
```

## Package Dependencies

### Dev Dependencies

- `@derrops/private` - Core types and utilities
- `@derrops/public` - Shared utilities
- `@derrops/client` - Base HTTP client
- `@derrops/client-nodejs-axios` - Axios client implementation
- `axios` - HTTP client (peer dependency of axios client)
- Testing frameworks (Jest, ts-jest)
- Build tools (tsup, TypeScript)

## Structure

```
@derrops/test/
├── src/
│   ├── __tests__/          # Integration test files
│   │   └── integration.test.ts
│   └── index.ts            # Package exports
├── dist/                   # Built output (generated)
├── jest.config.js          # Jest configuration
├── jest.setup.js           # Jest setup file
├── package.json
├── tsconfig.json
└── README.md
```

## Notes

- This package is **private** and not published to npm
- It should only contain integration tests and test utilities
- For unit tests specific to a package, write them in that package's directory
- This package is built last in the dependency chain since it depends on all other packages

## License

MIT
