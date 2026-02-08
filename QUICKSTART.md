# SLAOps Platform - Quick Start Guide

This guide helps you quickly get started with the SLAOps platform development environment and common workflows.

## Prerequisites

- **Node.js >= 22.0.0** (install via nvm: `nvm use`)
- **pnpm 8.15.4+** (`npm install -g pnpm@8.15.4`)
- **Claude Code CLI** (for AI-powered commit messages)
- **Docker** (for local backend services)
- **tmuxinator** (for managing development sessions)

## Initial Setup

```bash
# Clone and install dependencies
git clone <repository-url>
cd slaops-platform
pnpm install --frozen-lockfile

# Build all packages
pnpm run build
```

## Development Environment

### Starting the Backend Services

Start the Docker-based backend environment (PostgreSQL, OpenSearch, etc.) using tmuxinator:

```bash
./scripts/quickstart.sh
```

This command:

- Launches a tmuxinator session defined in `.tmuxinator.yml`
- Starts all required Docker containers
- Sets up the local development environment

### Opening Development Dashboards

Open all useful development URLs in Safari:

```bash
./scripts/browser.sh
```

This opens:

- **OpenSearch Dashboards**: http://192.168.7.224:5601
- **SLAOps Portal**: http://localhost:8080
- **SLAOps Docs**: http://localhost:8081
- **SLAOps Cloud API**: http://localhost:3001/api
- **Syncthing Server**: http://192.168.7.224:8384/#
- **Syncthing Localhost**: http://localhost:8384/#
- **PGAdmin**: http://192.168.7.224:5050

## Common Workflows

### Working with Git

#### AI-Powered Commit Messages

Generate intelligent commit messages using Claude AI:

```bash
# Basic usage - analyzes staged changes and generates commit message
./scripts/ai-commit.sh

# With context - provide additional context for better commit messages
./scripts/ai-commit.sh "Fixed debug configuration so that now debug is working"

# Interactive context - opens editor to write detailed context
./scripts/ai-commit.sh --context

# Or use the pnpm script
pnpm run commit
```

**Features:**

- Automatically stages files if needed (with confirmation)
- Generates conventional commit messages with emojis
- Opens editor for review and editing before committing
- Follows repository commit conventions

**Examples of generated messages:**

- `✨ feat(auth): add OAuth2 login flow`
- `🐛 fix(api): handle null response in user endpoint`
- `📝 docs: update installation instructions for Docker setup`
- `♻️ refactor(database): simplify query builder logic`

### Working with the Portal (Loveable Integration)

The SLAOps Portal (`apps/slaops-portal`) is also maintained as a separate repository for deployment on Loveable. Use these scripts to sync changes:

#### Pushing Portal Changes to Loveable

After making changes to `apps/slaops-portal`, push them to the Loveable repository:

```bash
./scripts/push-portal.sh
```

This command:

- Uses git subtree to push only the `apps/slaops-portal` directory
- Pushes to: `git@github.com:derrickfutschik/slaops-portal.git` (main branch)
- Preserves the portal's independent git history

#### Pulling Portal Changes from Loveable

Pull changes made in the Loveable environment back to the monorepo:

```bash
./scripts/pull-portal.sh
```

This command:

- Uses git subtree to pull changes from the Loveable repository
- Pulls from: `git@github.com:derrickfutschik/slaops-portal.git` (main branch)
- Squashes commits to keep monorepo history clean

**Workflow example:**

```bash
# 1. Make changes to apps/slaops-portal
cd apps/slaops-portal
# ... edit files ...

# 2. Commit changes using AI
cd ../..
./scripts/ai-commit.sh "Updated portal dashboard components"

# 3. Push to Loveable
./scripts/push-portal.sh

# 4. Later, pull any changes made in Loveable
./scripts/pull-portal.sh
```

## Development Scripts

### Building and Testing

```bash
# Build all packages in dependency order
pnpm run build

# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run development mode (watch mode for all packages)
pnpm run dev

# Clean all build artifacts
pnpm run clean
```

### Infrastructure Management

```bash
# AWS CDK Infrastructure (databases, VPC, networking)
pnpm infra:deploy      # Deploy infrastructure
pnpm infra:diff        # Preview changes
pnpm infra:destroy     # Destroy infrastructure

# AWS Amplify Backend (authentication, APIs, functions)
pnpm amplify:sandbox   # Local sandbox environment
pnpm amplify:deploy    # Deploy to AWS
```

### Application Development

```bash
# Documentation site (port 3000)
cd apps/slaops-docs
pnpm start

# Web portal (port 8080)
cd apps/slaops-portal
pnpm run dev
```

## Quick Reference

### Script Locations

All utility scripts are located in the `scripts/` directory:

| Script           | Purpose                              |
| ---------------- | ------------------------------------ |
| `ai-commit.sh`   | AI-powered commit message generation |
| `push-portal.sh` | Push portal changes to Loveable      |
| `pull-portal.sh` | Pull portal changes from Loveable    |
| `quickstart.sh`  | Start backend services (tmuxinator)  |
| `browser.sh`     | Open development dashboards          |
| `shutdown.sh`    | Stop backend services                |

### Port Reference

| Service                   | Port | URL                       |
| ------------------------- | ---- | ------------------------- |
| Documentation             | 3000 | http://localhost:3000     |
| Cloud API                 | 3001 | http://localhost:3001/api |
| OpenSearch Dashboards     | 5601 | http://192.168.7.224:5601 |
| PGAdmin                   | 5050 | http://192.168.7.224:5050 |
| Portal                    | 8080 | http://localhost:8080     |
| Portal (production build) | 8081 | http://localhost:8081     |
| Syncthing (server)        | 8384 | http://192.168.7.224:8384 |
| Syncthing (local)         | 8384 | http://localhost:8384     |

### Environment Files

Create these `.env` files as needed:

```bash
# apps/slaops-portal/.env
# (Add portal-specific environment variables)

# packages/slaops-backend/.env
# (Add backend-specific environment variables)
```

## Troubleshooting

### Backend services not starting

```bash
# Check Docker is running
docker ps

# Restart services
./scripts/quickstart.sh
```

### Git subtree sync issues

```bash
# If pull conflicts occur, you may need to force
git subtree pull --prefix=apps/slaops-portal \
  git@github.com:derrickfutschik/slaops-portal.git main \
  --squash --force
```

### Claude Code not found

```bash
# Install Claude Code CLI
# Visit: https://github.com/anthropics/claude-code
```

### Port conflicts

```bash
# Find process using a port (e.g., 8080)
lsof -i :8080

# Kill the process
kill -9 <PID>
```

## Next Steps

- Read the full documentation in [CLAUDE.md](./CLAUDE.md)
- Review package-specific guides:
  - [Documentation Site](./apps/slaops-docs/CLAUDE.md)
  - [Web Portal](./apps/slaops-portal/CLAUDE.md)
- Check out [scripts/README.md](./scripts/README.md) for detailed script documentation

## Tips

1. **Use AI commits regularly** - The AI commit tool saves time and ensures consistent commit messages
2. **Keep portal in sync** - Regularly push/pull portal changes if working with Loveable
3. **Use quickstart script** - It sets up the complete development environment in one command
4. **Open dashboards early** - Run `browser.sh` to quickly access all development tools
5. **Check git status** - The AI commit script will help you stage files interactively

---

For detailed information about the monorepo structure, build system, and architecture decisions, see [CLAUDE.md](./CLAUDE.md).
