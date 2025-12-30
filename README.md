# SLAOps Platform

> A comprehensive DevOps engineering solution for monitoring, logging, and analyzing HTTP requests and API usage across your applications.

[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15.4%2B-orange.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3%2B-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Quick Start with Tmux](#quick-start-with-tmux)
- [Monorepo Structure](#monorepo-structure)
- [Development](#development)
- [Packages](#packages)
- [Applications](#applications)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Overview

SLAOps (Service Level Agreement Operations) is a powerful platform that provides:

- 📊 **HTTP Request/Response Monitoring** - Track and analyze all HTTP traffic
- 📋 **OpenAPI Specification Validation** - Ensure API compliance
- ⚡ **API Performance Tracking** - Monitor response times and throughput
- 🎯 **SLA Compliance Monitoring** - Track service level agreements
- 💰 **Cost Analysis** - Monitor and optimize API usage costs
- 🔔 **Real-time Alerts** - Get notified of issues immediately

This monorepo contains both the core client libraries for instrumenting applications and the platform applications (documentation site and web portal).

## Features

### Core Libraries

- **Type-safe TypeScript** clients with full ESM + CJS support
- **Axios interceptor** for automatic request/response capture
- **Configurable header redaction** for security
- **Zero-config setup** with sensible defaults
- **Minimal performance overhead**

### Platform Applications

- **Documentation Site** ([https://blog.SLAOps.com](https://blog.SLAOps.com))
  - Comprehensive guides and API reference
  - Blog with release notes and changelog
  - Interactive examples with Mermaid diagrams

- **Web Portal**
  - Real-time service monitoring dashboard
  - API performance metrics and analytics
  - Cost tracking and analysis
  - Alert management and configuration

## Quick Start

### Prerequisites

Before getting started, ensure you have:

1. **Node.js >= 22.0.0** ([Download](https://nodejs.org/))

   ```bash
   # Using nvm (recommended)
   nvm install 22
   nvm use 22
   ```

2. **pnpm 8.15.4+** (fast, disk-efficient package manager)

   ```bash
   npm install -g pnpm@8.15.4
   # or using corepack
   corepack enable pnpm
   ```

3. **Tmux and Tmuxinator** (optional, for quick development setup)

   ```bash
   # macOS
   brew install tmux tmuxinator

   # Ubuntu/Debian
   sudo apt-get install tmux tmuxinator
   ```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/slaops-platform.git
cd slaops-platform

# Install all dependencies
pnpm install

# Build all packages (required before first run)
pnpm run build
```

### Quick Start with Tmux

The fastest way to get the entire platform running in local development is using tmux:

```bash
# Start all services with tmuxinator
tmuxinator start -p .tmuxinator.yml
```

Or alternatively, run:

```bash
./quick-start.sh
```

This will automatically:

- Start OpenSearch (Docker) on window `slaops-opensearch`
- Start documentation site on port 3000 in window `slaops-docs`
- Start web portal on port 8080 in window `slaops-portal`
- Create a root window for git commands and builds

**Tmux Navigation:**

- `Ctrl+b` then `w` - List and switch between windows
- `Ctrl+b` then `n` - Next window
- `Ctrl+b` then `p` - Previous window
- `Ctrl+b` then `d` - Detach from session (keeps running)
- `tmux attach -t slaops-apps` - Reattach to session

**Access the applications:**

| Service                      | Port | URL                                            | Location              | Description                     |
| ---------------------------- | ---- | ---------------------------------------------- | --------------------- | ------------------------------- |
| **Documentation Site**       | 3000 | [http://localhost:3000](http://localhost:3000) | `apps/slaops-docs/`   | Docusaurus documentation site   |
| **Web Portal**               | 8080 | [http://localhost:8080](http://localhost:8080) | `apps/slaops-portal/` | React monitoring dashboard      |
| **OpenSearch**               | 9200 | [http://localhost:9200](http://localhost:9200) | Docker container      | OpenSearch database (REST API)  |
| **OpenSearch** (Performance) | 9600 | http://localhost:9600                          | Docker container      | OpenSearch performance analyzer |
| **OpenSearch Dashboard**     | 5601 | [http://localhost:5601](http://localhost:5601) | Docker container      | OpenSearch UI/Kibana            |

### Manual Start (Alternative)

If you prefer to run services individually:

```bash
# Terminal 1: Documentation site
cd apps/slaops-docs
pnpm start

# Terminal 2: Web portal
cd apps/slaops-portal
pnpm run dev

# Terminal 3: OpenSearch (if needed)
docker-compose up
```

## Monorepo Structure

```
slaops-platform/
├── packages/                    # Shared libraries and utilities
│   ├── slaops-private/            # @slaops/private - Core types and utilities
│   ├── slaops-public/             # @slaops/public - Shared utilities
│   ├── slaops-client/          # @slaops/client - Base HTTP client
│   └── slaops-client-nodejs-axios/  # Axios client implementation
│
├── apps/                        # Platform applications
│   ├── slaops-docs/            # Docusaurus documentation site (port 3000)
│   └── slaops-portal/          # React web portal (port 8080)
│
├── scripts/                     # Utility scripts
│   └── ai-commit.sh            # AI-powered git commit helper
│
├── .tmuxinator.yml             # Tmux development environment config
├── docker-compose.yml          # Docker services (OpenSearch)
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── package.json                # Root package configuration
└── tsconfig.base.json          # Shared TypeScript configuration
```

## Development

### Building

```bash
# Build all packages in dependency order
pnpm run build

# Build specific package
pnpm --filter @slaops/private run build
pnpm --filter @slaops/client run build
```

### Running in Development Mode

```bash
# Run all packages in watch mode
pnpm run dev

# Run specific application
pnpm --filter slaops-docs start        # Documentation site
pnpm --filter vite_react_shadcn_ts run dev  # Web portal
```

### Common Commands

```bash
pnpm run build        # Build all packages and apps
pnpm run dev          # Run all in development mode
pnpm run test         # Run all tests
pnpm run test:watch   # Run tests in watch mode
pnpm run clean        # Remove all build artifacts
pnpm run commit       # AI-powered git commit helper
```

## Packages

### [@slaops/private](packages/slaops-private/)

Core types, interfaces, and utilities shared across all packages. Private package not published to npm.

### [@slaops/public](packages/slaops-public/)

Shared utility functions and helpers. Published to npm.

**Key exports:**

- HTTP request/response utilities
- Data transformation helpers
- Validation functions

### [@slaops/client](packages/slaops-client/)

Base HTTP client implementation that can be extended for specific HTTP clients. Published to npm.

**Key exports:**

- `SlaOpsClient` base class
- Client configuration types
- Event sending logic

### [slaops-client-nodejs-axios](packages/slaops-client-nodejs-axios/)

Production-ready Axios client with automatic interceptor support. Published to npm.

**Quick Example:**

```typescript
import axios from 'axios'
import { attachSlaOpsInterceptor } from 'slaops-client-nodejs-axios'

const api = axios.create({ baseURL: 'https://api.example.com' })

attachSlaOpsInterceptor(api, {
  endpoint: process.env.SLAOPS_ENDPOINT!,
  apiKey: process.env.SLAOPS_API_KEY,
  projectId: 'my-project',
  redactHeaders: [/authorization/i, /cookie/i],
  includeRequestBody: false,
  includeResponseBody: false,
})

// Now all requests are automatically monitored
await api.get('/users')
```

## Applications

### [slaops-docs](apps/slaops-docs/) - Documentation Site

Docusaurus-powered documentation site with comprehensive guides and API reference.

- **URL:** [https://blog.SLAOps.com](https://blog.SLAOps.com)
- **Local:** http://localhost:3000
- **Tech:** Docusaurus 3.9.2 + React 19

```bash
cd apps/slaops-docs
pnpm start          # Development server
pnpm run build      # Production build
pnpm run serve      # Preview production build
```

### [slaops-portal](apps/slaops-portal/) - Web Portal

React-based monitoring dashboard for viewing metrics, logs, and alerts.

- **Local:** http://localhost:8080
- **Tech:** React 18 + Vite + TypeScript + Supabase + shadcn/ui

```bash
cd apps/slaops-portal
pnpm run dev        # Development server
pnpm run build      # Production build
```

## Testing

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Test specific package
pnpm --filter @slaops/private run test
pnpm --filter slaops-client-nodejs-axios run test
```

### Test Resources

The monorepo uses external OpenAPI specifications for comprehensive testing:

```bash
# Setup test resources (automatically done during pnpm install)
pnpm run setup:test-resources

# Verify test resources
ls test-resources/openapi-directory/APIs
```

## Build Order and Dependencies

Packages must be built in dependency order:

```
@slaops/private (base, no dependencies)
    ↓
@slaops/public + @slaops/client (depend on core)
    ↓
slaops-client-nodejs-axios (depends on core + client)
```

The root `pnpm run build` script handles this automatically.

## Working with the Monorepo

### Adding Dependencies

```bash
# Add to root (dev dependencies only)
pnpm add -D -w <package>

# Add to specific workspace
pnpm --filter @slaops/private add <package>
pnpm --filter slaops-docs add <package>
```

### Workspace Commands

```bash
# List all workspaces
pnpm -r list

# Run command in all workspaces
pnpm -r <command>

# Run command in specific workspace
pnpm --filter <workspace-name> <command>

# Update dependencies
pnpm update -r
```

## Utility Scripts

### AI-Powered Git Commits

The platform includes an AI-powered commit message generator:

```bash
# Using pnpm script (recommended)
pnpm run commit

# With context
pnpm run commit "Fixed debug configuration"

# Interactive context input
./scripts/ai-commit.sh --context
```

**Features:**

- Analyzes git diff and generates contextual commit messages
- Follows conventional commit format with emojis
- Opens editor for review and editing
- Interactive staging if needed

See [scripts/README.md](scripts/README.md) for more details.

## Environment Configuration

- `.nvmrc` - Node.js version specification (22)
- `.prettierrc` - Code formatting rules
- `.editorconfig` - Editor configuration
- `tsconfig.base.json` - Base TypeScript configuration

## Troubleshooting

### Module Not Found Errors

```bash
# Rebuild all packages in correct order
pnpm run clean
pnpm install
pnpm run build
```

### Port Conflicts

- Documentation site uses port 3000
- Web portal uses port 8080
- Change ports in respective configs if needed

### TypeScript Errors

```bash
# Rebuild core packages first
pnpm --filter @slaops/private run build
pnpm --filter @slaops/public run build
pnpm run build
```

## Architecture & Technology

### Why pnpm?

- Efficient disk space usage via hard links
- Strict dependency resolution prevents phantom dependencies
- Fast installation and excellent monorepo support

### Why TypeScript?

- Type safety across the entire codebase
- Better IDE support and autocomplete
- Easier refactoring and self-documenting code

### Why tsup?

- Fast TypeScript bundler with zero-config
- Supports dual ESM + CJS output
- Great developer experience with watch mode

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `pnpm run test && pnpm run build`
5. Use `pnpm run commit` for commit messages
6. Submit a pull request

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines.

## Documentation

- **Main Documentation:** [https://blog.SLAOps.com](https://blog.SLAOps.com)
- **Package READMEs:** See individual packages for specific documentation
- **Developer Guide:** [CLAUDE.md](CLAUDE.md)
- **Scripts Guide:** [scripts/README.md](scripts/README.md)

## Resources

- [pnpm Documentation](https://pnpm.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [Docusaurus Documentation](https://docusaurus.io/)
- [Tmuxinator Documentation](https://github.com/tmuxinator/tmuxinator)
- [NestJS Documentation](https://docs.nestjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [OpenSearch Documentation](https://opensearch.org/docs/)
- [OpenSearch Dashboards Documentation](https://opensearch.org/docs/latest/dashboards/index/)
- [LocalStack Documentation](https://localstack.cloud/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Tmuxinator Documentation](https://github.com/tmuxinator/tmuxinator)
- [Tmux Documentation](https://github.com/tmux/tmux/wiki)

---

## Dev Server

A Dev server can be used to run the docker-compose bootstrap environment which can greatly reduce the load on the main platform.

To shutdown the dev server and bring down the docker-compose environment:

```bash
sudo shutdown +5
docker compose down
```

## TODO

- [ ] Add a way to configure where the docker-compose bootstrap environment is located, or to run against another environment if needed. Preferably via a .env file.
