# SLAOps Platform

A comprehensive monorepo for the SLAOps platform - a DevOps engineering solution for monitoring, logging, and analyzing HTTP requests and API usage across your applications.

## Overview

SLAOps (Service Level Agreement Operations) provides tools and libraries for:
- HTTP request/response monitoring and logging
- OpenAPI specification validation and analysis
- API performance tracking and metrics
- SLA compliance monitoring
- Cost analysis for API usage
- Real-time alerts and notifications

This monorepo contains both the core client libraries for instrumenting applications and the platform applications (documentation site and web portal).

## Monorepo Structure

```
slaops-platform/
├── packages/                    # Shared libraries and utilities
│   ├── slaops-core/            # @slaops/core - Core types and utilities (private)
│   ├── slaops-lib/             # @slaops/lib - Shared utilities
│   ├── slaops-client/          # @slaops/client - Base HTTP client
│   └── slaops-client-nodejs-axios/  # Axios-specific client implementation
│
├── apps/                        # Platform applications
│   ├── slaops-docs/            # Docusaurus documentation site
│   └── slaops-portal/          # React web portal for monitoring
│
├── scripts/                     # Utility scripts
│   ├── ai-commit.sh            # AI-powered git commit helper
│   ├── generate-commit-message.cjs  # Commit message generator
│   └── README.md               # Scripts documentation
│
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── package.json                # Root package configuration
├── tsconfig.base.json          # Shared TypeScript configuration
└── CLAUDE.md                   # This file
```

## Technology Stack

### Package Manager
- **pnpm 8.15.4+** - Fast, disk space efficient package manager for monorepos

### Core Technologies
- **TypeScript 5.6.3+** - Type-safe JavaScript
- **Node.js >= 22.0.0** - Runtime environment
- **tsup** - TypeScript bundler for packages
- **Vitest** - Unit testing framework

### Build System
- **pnpm workspaces** - Monorepo workspace management
- **Dependency graph**: core → lib → client → client-nodejs-axios

## Getting Started

### Prerequisites

1. **Node.js >= 22.0.0**
   ```bash
   # Install using nvm (recommended)
   nvm use
   # or install Node.js 22+ manually
   ```

2. **pnpm 8.15.4+**
   ```bash
   npm install -g pnpm@8.15.4
   # or
   corepack enable pnpm
   ```

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd slaops-platform

# Install all dependencies (from root)
pnpm install --frozen-lockfile

# Build all packages in dependency order
pnpm run build
```

## Development Workflow

### Building Packages

```bash
# Build all packages in dependency order
pnpm run build

# Build specific package
pnpm --filter @slaops/core run build
pnpm --filter @slaops/lib run build
pnpm --filter @slaops/client run build
pnpm --filter slaops-client-nodejs-axios run build

# Build specific app
pnpm --filter slaops-docs run build
pnpm --filter vite_react_shadcn_ts run build
```

### Running in Development

```bash
# Run all packages in watch mode
pnpm run dev

# Run specific package
pnpm --filter @slaops/core run dev
pnpm --filter slaops-docs start
pnpm --filter vite_react_shadcn_ts run dev
```

### Testing

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Test specific package
pnpm --filter @slaops/core run test
```

### Test Resources

The monorepo uses external test resources (primarily OpenAPI specifications from the [APIs-guru/openapi-directory](https://github.com/APIs-guru/openapi-directory)) for comprehensive testing. These resources are:

- **Automatically set up** during `pnpm install` via postinstall script
- **Not included in source control** (gitignored)
- **Excluded from IDE indexing** (via .cursorignore and .claudeignore)

```bash
# Manual setup/refresh of test resources
pnpm run setup:test-resources --force

# Verify test resources are available
ls test-resources/openapi-directory/APIs
```

**Using test resources in tests:**

```typescript
import {
  loadOpenApiSpec,
  listAvailableSpecs,
  findSpecs,
} from '@slaops/core/src/test-utils/openapi-loader';

// Load a specific OpenAPI spec
const spec = await loadOpenApiSpec('github.com', 'api.github.com', '1.1.4');

// Find all GitHub specs
const githubSpecs = await findSpecs('github');
```

See [test-resources/README.md](test-resources/README.md) for complete documentation on available test resources and utilities.

### Cleaning

```bash
# Remove all build artifacts and node_modules
pnpm run clean
```

## Package Details

### @slaops/core (packages/slaops-core/)

**Core types and utilities for SLA Ops**

- **Status**: Private (not published to npm)
- **Purpose**: Foundation types, interfaces, and utilities shared across all packages
- **Output**: ESM + CJS with TypeScript declarations
- **Dependencies**: None (base package)

Key exports:
- Core TypeScript types and interfaces
- Shared constants and enums
- Base utility functions

```bash
cd packages/slaops-core
pnpm run build      # Build with tsup
pnpm run test       # Run tests
pnpm run dev        # Watch mode
```

### @slaops/lib (packages/slaops-lib/)

**Shared utilities for SLA Ops**

- **Status**: Public (published to npm)
- **Purpose**: Reusable utility functions and helpers
- **Output**: ESM + CJS with TypeScript declarations
- **Dependencies**: @slaops/core

Key exports:
- HTTP request/response utilities
- Data transformation helpers
- Validation functions
- Common utilities

```bash
cd packages/slaops-lib
pnpm run build      # Build with tsup
pnpm run test       # Run tests
pnpm run dev        # Watch mode
```

### @slaops/client (packages/slaops-client/)

**Base HTTP client for SLA Ops**

- **Status**: Public (published to npm)
- **Purpose**: Base client implementation that can be extended for specific HTTP clients
- **Output**: ESM + CJS with TypeScript declarations
- **Dependencies**: @slaops/core

Key exports:
- `SlaOpsClient` base class
- Client configuration types
- Event sending logic
- HTTP client abstractions

```bash
cd packages/slaops-client
pnpm run build      # Build with tsup
pnpm run test       # Run tests
pnpm run dev        # Watch mode
```

### slaops-client-nodejs-axios (packages/slaops-client-nodejs-axios/)

**Axios-specific client for Node.js/TypeScript**

- **Status**: Public (published to npm)
- **Purpose**: Production-ready Axios client with interceptor support
- **Output**: ESM + CJS with TypeScript declarations
- **Dependencies**: @slaops/core, @slaops/client

Key features:
- Automatic request/response capture via Axios interceptors
- Configurable header redaction
- Optional request/response body capture
- Internal request prevention (no recursive interception)
- Minimal overhead

Example usage:
```typescript
import axios from 'axios';
import { attachSlaOpsInterceptor } from 'slaops-client-nodejs-axios';

const api = axios.create({ baseURL: 'https://api.example.com' });

attachSlaOpsInterceptor(api, {
  endpoint: process.env.SLAOPS_ENDPOINT!,
  apiKey: process.env.SLAOPS_API_KEY,
  projectId: 'my-project',
  redactHeaders: [/authorization/i, /cookie/i],
  includeRequestBody: false,
  includeResponseBody: false,
});
```

```bash
cd packages/slaops-client-nodejs-axios
pnpm run build      # Build with tsup
pnpm run test       # Run tests
pnpm run dev        # Watch mode
```

### slaops-docs (apps/slaops-docs/)

**Docusaurus documentation site**

- **Status**: Private
- **Purpose**: Platform documentation at https://blog.SLAOps.com
- **Technology**: Docusaurus 3.9.2 with React 19
- **Port**: 3000 (development)

Key features:
- Comprehensive guides and tutorials
- API reference documentation
- Blog with release notes
- Changelog tracking
- Mermaid diagrams and math equations

See [apps/slaops-docs/CLAUDE.md](apps/slaops-docs/CLAUDE.md) for detailed documentation.

```bash
cd apps/slaops-docs
pnpm start          # Start dev server
pnpm run build      # Build for production
pnpm run serve      # Preview production build
```

### slaops-portal (apps/slaops-portal/)

**React web portal for monitoring**

- **Status**: Private
- **Purpose**: Dashboard for viewing metrics, logs, and alerts
- **Technology**: React 18 + Vite + TypeScript + Supabase
- **Port**: 8080 (development)

Key features:
- Real-time service monitoring
- API performance metrics
- Cost analysis and tracking
- Alert management
- Service configuration
- shadcn/ui component library

See [apps/slaops-portal/CLAUDE.md](apps/slaops-portal/CLAUDE.md) for detailed documentation.

```bash
cd apps/slaops-portal
pnpm run dev        # Start dev server
pnpm run build      # Build for production
pnpm run build:dev  # Build for development
```

## Build Order and Dependencies

The packages have a specific dependency hierarchy that must be respected when building:

```
@slaops/core (no dependencies)
    ↓
@slaops/lib (depends on core)
    ↓
@slaops/client (depends on core)
    ↓
slaops-client-nodejs-axios (depends on core, client)
```

The root `pnpm run build` script handles this order automatically:
```bash
pnpm -r --filter @slaops/core run build &&
pnpm -r --filter @slaops/lib run build &&
pnpm -r --filter @slaops/client run build &&
pnpm -r --filter slaops-client-nodejs-axios run build &&
pnpm -r --filter slaops-docs run build &&
pnpm -r --filter vite_react_shadcn_ts run build
```

## Working with the Monorepo

### Adding Dependencies

```bash
# Add to root (dev dependencies only)
pnpm add -D -w <package>

# Add to specific workspace
pnpm --filter @slaops/core add <package>
pnpm --filter slaops-docs add <package>

# Add workspace dependency
cd packages/slaops-lib
# Edit package.json to add "@slaops/core": "*"
pnpm install
```

### Creating a New Package

1. Create directory in `packages/` or `apps/`
2. Initialize with `package.json`:
   ```json
   {
     "name": "@slaops/new-package",
     "version": "0.1.0",
     "type": "module",
     "main": "./dist/index.cjs",
     "module": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "scripts": {
       "build": "tsup src/index.ts --format esm,cjs --dts --clean"
     }
   }
   ```
3. Run `pnpm install` from root
4. Add to build script if needed

### pnpm Workspace Commands

```bash
# List all workspaces
pnpm -r list

# Run command in all workspaces
pnpm -r <command>

# Run command in specific workspace
pnpm --filter <workspace-name> <command>

# Run command in multiple workspaces
pnpm --filter @slaops/* run build

# Update dependencies
pnpm update -r
pnpm update --filter @slaops/core
```

## Git Workflow

### Branches
- `main` - Primary development branch
- Feature branches - For new features and bug fixes

### Git Status (Current)
```
Current branch: main
Untracked files:
  apps/slaops-docs/CLAUDE.md
  apps/slaops-portal/CLAUDE.md
```

### Recent Commits
- `128abad` - CI: Only run slaops-docs if apps/slaops-docs/ changes
- `cb4a190` - CI: Do not run slaops-portal if no changes in that dir
- `76d57e9` - Fix build with new types
- `ef5246b` - Proper types

## CI/CD

### GitHub Actions
Located in `.github/workflows/`:
- Conditional builds based on changed paths
- Separate workflows for docs and portal
- Build verification on pull requests

### AWS Amplify
Both apps are configured for AWS Amplify deployment:
- `amplify.yml` - Build specification
- `amplify-prebuild.sh` - Environment setup
- `amplify-build.sh` - Build execution

## Scripts Reference

### Root Level Scripts

```bash
pnpm run build        # Build all packages and apps
pnpm run dev          # Run all packages in development mode
pnpm run test         # Run all tests
pnpm run test:watch   # Run all tests in watch mode
pnpm run clean        # Remove all build artifacts and node_modules
pnpm run commit       # AI-powered git commit with generated message
pnpm run commit:ai    # Alias for commit
```

### Utility Scripts

#### AI Commit (`scripts/ai-commit.sh`)

An AI-powered git commit helper that generates meaningful commit messages based on your changes.

**Features:**
- Analyzes git diff and changed files
- Generates contextual commit messages
- References recent commits for style consistency
- Interactive editor for review and editing
- Confirms before committing

**Usage:**
```bash
# Using pnpm script (recommended)
pnpm commit

# Direct execution
./scripts/ai-commit.sh
```

**Workflow:**
1. Detects staged or unstaged changes
2. Prompts to stage files if needed
3. Generates an AI commit message
4. Opens editor for review
5. Confirms and commits

See [scripts/README.md](scripts/README.md) for detailed documentation.

### Package Level Scripts

Each package typically has:
```bash
pnpm run build        # Build with tsup
pnpm run dev          # TypeScript watch mode
pnpm run test         # Run vitest
pnpm run test:watch   # Run vitest in watch mode
```

### App Level Scripts

**slaops-docs**:
```bash
pnpm start            # Development server
pnpm run build        # Production build
pnpm run serve        # Preview production build
pnpm run clear        # Clear cache
pnpm run typecheck    # Type checking
```

**slaops-portal**:
```bash
pnpm run dev          # Development server
pnpm run build        # Production build
pnpm run build:dev    # Development build
pnpm run preview      # Preview production build
pnpm run lint         # ESLint
```

## Environment Configuration

### Root Level
- `.nvmrc` - Node.js version (22)
- `.prettierrc` - Code formatting rules
- `.editorconfig` - Editor configuration
- `tsconfig.base.json` - Base TypeScript config

### Package Level
Each package/app may have:
- `tsconfig.json` - Package-specific TypeScript config
- `.env` files - Environment variables (not committed)
- Build configuration files

## Common Tasks

### Adding a New Feature

1. Determine which package(s) need changes
2. Create feature branch
3. Make changes, ensuring tests pass
4. Build affected packages: `pnpm --filter <package> run build`
5. Test integration: `pnpm run test`
6. Update documentation if needed
7. Commit and push

### Publishing Packages

```bash
# Ensure all tests pass
pnpm run test

# Build all packages
pnpm run build

# Publish (from package directory)
cd packages/slaops-client-nodejs-axios
npm publish --access public
```

### Debugging Build Issues

1. Check build order - core must build before lib, etc.
2. Verify all dependencies are installed: `pnpm install`
3. Clear all builds: `pnpm run clean`
4. Rebuild from scratch: `pnpm install && pnpm run build`
5. Check for TypeScript errors: `pnpm -r run typecheck` (where available)

### Updating Dependencies

```bash
# Check for outdated dependencies
pnpm outdated -r

# Update all dependencies
pnpm update -r

# Update specific package
pnpm --filter @slaops/core update <dependency>
```

## Troubleshooting

### "Module not found" errors
- Ensure packages are built in correct order
- Run `pnpm run build` from root
- Check `package.json` dependencies are correct

### pnpm install fails
- Verify pnpm version: `pnpm --version`
- Try: `pnpm install --no-frozen-lockfile`
- Check Node.js version matches `.nvmrc`

### TypeScript errors across packages
- Rebuild core packages first
- Ensure `tsconfig.base.json` is properly referenced
- Check package exports in `package.json`

### Port conflicts (apps)
- slaops-docs uses port 3000
- slaops-portal uses port 8080
- Change ports in respective configs if needed

## Best Practices

### Code Organization
- Keep shared code in `@slaops/core` and `@slaops/lib`
- Specific implementations go in their own packages
- Apps should depend on packages, not vice versa

### TypeScript
- Use strict mode
- Define types in core packages
- Export only necessary types
- Use consistent module resolution

### Testing
- Write unit tests for all packages
- Keep tests close to source code
- Use Vitest for consistency
- Aim for high coverage on core packages

### Documentation
- **IMPORTANT**: When completing tasks, add or update documentation in [apps/slaops-docs/](apps/slaops-docs/)
- Before starting a task, review existing documentation in [apps/slaops-docs/docs/](apps/slaops-docs/docs/) for context
- Update CLAUDE.md files when making significant changes
- Keep README.md files up to date
- Document public APIs thoroughly in the docs site
- Include usage examples and code snippets
- Update relevant documentation in the same commit as code changes

### Git
- Commit messages should be clear and descriptive
- Keep commits focused and atomic
- Update relevant documentation in the same commit
- Test builds before pushing

## Architecture Decisions

### Why pnpm?
- Efficient disk space usage via hard links
- Strict dependency resolution prevents phantom dependencies
- Fast installation and better monorepo support
- Native workspace support

### Why TypeScript?
- Type safety across the entire codebase
- Better IDE support and autocomplete
- Easier refactoring
- Self-documenting code

### Why tsup?
- Fast TypeScript bundler
- Zero-config for most use cases
- Supports ESM + CJS output
- Good DX with watch mode

### Monorepo Strategy
- Shared code in packages for reusability
- Apps consume packages as dependencies
- Build order enforced by dependency graph
- Independent versioning possible

## Resources

### Documentation
- Main docs: https://blog.SLAOps.com
- Package READMEs in each package directory
- Individual CLAUDE.md files in apps/

### External Links
- [pnpm documentation](https://pnpm.io/)
- [TypeScript handbook](https://www.typescriptlang.org/docs/)
- [Vitest documentation](https://vitest.dev/)
- [tsup documentation](https://tsup.egoist.dev/)

### Repository
- Issues: Create issues in the GitHub repository
- Pull Requests: Follow the standard PR process
- Discussions: Use GitHub Discussions for questions

## License

MIT License (see LICENSE file)

## Author

SLAOps@SLAOps.com

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and build: `pnpm run test && pnpm run build`
5. Submit a pull request

---

**Last Updated**: November 2024

This file provides guidance for working with the SLAOps monorepo. For app-specific details, see:
- [apps/slaops-docs/CLAUDE.md](apps/slaops-docs/CLAUDE.md) - Documentation site
- [apps/slaops-portal/CLAUDE.md](apps/slaops-portal/CLAUDE.md) - Web portal

For package-specific details, see the README.md in each package directory.
