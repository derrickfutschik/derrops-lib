# @slaops/test

Integration test package for SLAOps with dependencies on all other packages.

## Purpose

This package exists to provide a convenient location for writing integration tests that require multiple SLAOps packages working together. Since it has dev dependencies on all other packages, you can import and test functionality across the entire monorepo without needing to set up complex dependencies.

## Features

- **All Dependencies**: Has dev dependencies on all SLAOps packages (@slaops/private, @slaops/public, @slaops/client, @slaops/client-nodejs-axios)
- **Integration Testing**: Write tests that verify how packages work together
- **Convenience**: No need to manually wire up package dependencies for cross-package tests

## Installation

This package is part of the SLAOps monorepo and is not published to npm.

```bash
# From monorepo root
pnpm install
```

## Usage

### Writing Integration Tests

Create test files in `src/__tests__/` or use the `.test.ts` suffix:

```typescript
import { describe, it, expect } from '@jest/globals';
import axios from 'axios';
import { attachSlaOpsInterceptor } from '@slaops/client-nodejs-axios';
// Import from any other SLAOps package as needed

describe('My Integration Test', () => {
  it('should test cross-package functionality', () => {
    // Your test here
  });
});
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

- `@slaops/private` - Core types and utilities
- `@slaops/public` - Shared utilities
- `@slaops/client` - Base HTTP client
- `@slaops/client-nodejs-axios` - Axios client implementation
- `axios` - HTTP client (peer dependency of axios client)
- Testing frameworks (Jest, ts-jest)
- Build tools (tsup, TypeScript)

## Structure

```
@slaops/test/
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
