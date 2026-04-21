# SLAOps Platform

A monorepo for the SLAOps platform — a DevOps solution for monitoring, logging, and analysing HTTP requests and API usage across your applications.

SLAOps provides: HTTP request/response monitoring, OpenAPI spec validation, API performance metrics, SLA compliance tracking, cost analysis, and real-time alerts.

## Monorepo Structure

```
slaops-platform/
├── packages/
│   ├── slaops-private/            # @slaops/private    – Core types & utilities (private, no deps)
│   ├── slaops-public/             # @slaops/public     – Shared utilities (public npm)
│   ├── slaops-config/             # @slaops/config     – Zod-validated config management
│   ├── slaops-client/             # @slaops/client     – Base HTTP client (public npm)
│   ├── slaops-client-nodejs-axios/# slaops-client-nodejs-axios – Axios interceptor client (public npm)
│   ├── slaops-infra/              # @slaops/infra      – AWS CDK stacks (DB, VPC, Auth, API GW)
│   ├── slaops-backend/            # @slaops/backend    – AWS Amplify Lambda function deployment
│   └── slaops-test/               # @slaops/test       – Cross-package integration tests
│
├── apps/
│   ├── slaops-docs/               # Docusaurus docs site → apps/slaops-docs/CLAUDE.md
│   ├── slaops-portal/             # React monitoring portal → apps/slaops-portal/CLAUDE.md
│   └── slaops-cloud/              # NestJS backend API → apps/slaops-cloud/CLAUDE.md
│
└── scripts/
    └── ai-commit.sh               # AI-powered commit message generator (pnpm commit)
```

### Package build order (dependency graph)

```
@slaops/private  (no deps)
       ↓
@slaops/public · @slaops/config (standalone, zod only)
       ↓
@slaops/client
       ↓
slaops-client-nodejs-axios
       ↓
@slaops/test  (dev deps on all — built last)
```

`pnpm run build` at the root handles this order automatically.

## Tech Stack

- **Runtime**: Node.js >= 22, TypeScript 5.6.3+
- **Package manager**: pnpm 8.15.4+ with workspaces
- **Build**: Turborepo 2.6.1 + tsup (ESM + CJS output)
- **Tests**: Vitest
- **Infra**: AWS CDK 2.130.0, AWS Amplify Gen 2, AWS Cognito

See [TURBO.md](TURBO.md) for Turborepo details.

## Getting Started

```bash
nvm use                          # Node 22
pnpm install --frozen-lockfile
pnpm run build
```

Common commands from the root:

```bash
pnpm run build        # Build all packages and apps in order
pnpm run dev          # Watch mode across all packages
pnpm run test         # Run all tests
pnpm run clean        # Remove all build artefacts and node_modules
pnpm run commit       # AI-powered git commit

# CDK infrastructure
pnpm infra:deploy     # Deploy all CDK stacks
pnpm infra:diff       # Preview changes

# Amplify backend
pnpm amplify:sandbox  # Local Lambda sandbox
pnpm amplify:deploy   # Deploy Lambda to AWS
```

Each package has the standard scripts: `build`, `dev`, `test`, `test:watch`, `clean`.

## Packages — quick reference

| Package                      | Purpose                                       | Details                                                    |
| ---------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `@slaops/private`            | Core types, interfaces, shared constants      | [CLAUDE.md](packages/slaops-private/CLAUDE.md)             |
| `@slaops/public`             | Reusable utilities (HTTP helpers, transforms) | [CLAUDE.md](packages/slaops-public/CLAUDE.md)              |
| `@slaops/config`             | Zod-validated config, dot-notation access     | [CLAUDE.md](packages/slaops-config/CLAUDE.md)              |
| `@slaops/client`             | Base SlaOps HTTP client class                 | [CLAUDE.md](packages/slaops-client/CLAUDE.md)              |
| `slaops-client-nodejs-axios` | Axios interceptor client for Node.js          | [CLAUDE.md](packages/slaops-client-nodejs-axios/CLAUDE.md) |
| `@slaops/infra`              | CDK stacks: VPC, Aurora, Cognito, API GW      | [CLAUDE.md](packages/slaops-infra/CLAUDE.md)               |
| `@slaops/backend`            | Amplify Lambda function deployment            | [CLAUDE.md](packages/slaops-backend/CLAUDE.md)             |
| `@slaops/test`               | Cross-package integration tests               | [CLAUDE.md](packages/slaops-test/CLAUDE.md)                |

## Apps — quick reference

| App             | Purpose                                                | Details                                   |
| --------------- | ------------------------------------------------------ | ----------------------------------------- |
| `slaops-docs`   | Docusaurus site at https://blog.SLAOps.com (port 3000) | [CLAUDE.md](apps/slaops-docs/CLAUDE.md)   |
| `slaops-portal` | React monitoring dashboard (port 8080)                 | [CLAUDE.md](apps/slaops-portal/CLAUDE.md) |
| `slaops-cloud`  | NestJS backend API (deployed as Lambda)                | [CLAUDE.md](apps/slaops-cloud/CLAUDE.md)  |

## Key Conventions

### Run Prettier after changes

After making any code changes, run `pnpm run format:changed` to format only modified/added/renamed files before committing. Use `pnpm run format` only when you need to reformat the entire project.

### Never use `process.env` directly

Always use `@slaops/config`. See [packages/slaops-config/CLAUDE.md](packages/slaops-config/CLAUDE.md) for the full API.

```typescript
// ✅
import { config } from '@slaops/config'
const port = config['app.port']

// ❌
const port = process.env.PORT
```

### No magic numbers or hardcoded values

Every configurable value (limits, sizes, timeouts, names, prefixes) must be a named property in `packages/slaops-config/src/config.ts` with a JSDoc comment. See [packages/slaops-config/CLAUDE.md](packages/slaops-config/CLAUDE.md).

### TypeScript path mappings

`paths` in `tsconfig.base.json` do **not** merge into child configs — each child must redeclare the paths it needs. See the path mapping convention in individual `tsconfig.json` files. Current cross-module mapping: `@slaops/cloud/*` → `apps/slaops-cloud/src/*`.

### DynamoDB vs Aurora

Use DynamoDB **only** for ultra-latency-sensitive hot paths (e.g. OASpec lookups during log enrichment). Default to Aurora Serverless v2 (PostgreSQL) for everything else.

### Design-Code Sync

When a code file implements a formal design document, add a `@designDoc` tag in its file-level JSDoc block referencing the design doc path (monorepo-root-relative). When editing a tagged file, check whether the change requires updating the linked design doc(s). See `.claude/rules/design-sync.md` for the full convention.

## Development Workflow

Follow these steps for any feature, fix, or significant change:

1. **Design** — write a design doc in `apps/slaops-docs/internal/platform/design/`
2. **Plan** — store the implementation plan in `apps/slaops-docs/plan/` (`.md`, Docusaurus format); cross-reference the design
3. **Implement** — follow the plan; add `@designDoc` tags to implementing files and `implements:` frontmatter to the design doc (see `.claude/rules/design-sync.md`); set `status: implemented` once shipped
4. **Document** — add/update public docs in `apps/slaops-docs/public/docs/`
5. **Commit** — Conventional Commits format (see [CONVENTIONS.md](CONVENTIONS.md))
6. **Release** — tag `vX.Y.Z`, add `apps/slaops-docs/changelog/source/X.Y.Z.md`

### Documentation locations

| Location                                     | Access  | Purpose                                 |
| -------------------------------------------- | ------- | --------------------------------------- |
| `apps/slaops-docs/public/docs/`              | Public  | User-facing platform docs               |
| `apps/slaops-docs/public/security/`          | Public  | Customer security / compliance overview |
| `apps/slaops-docs/internal/platform/design/` | Private | ADRs, design docs                       |
| `apps/slaops-docs/internal/platform/drafts/` | Private | WIP ideas, research notes               |
| `apps/slaops-docs/internal/developer/code/`  | Private | Auto-copied monorepo READMEs            |
| `apps/slaops-docs/internal/devops/`          | Private | Sprint planning, user stories           |
| `apps/slaops-docs/internal/security/`        | Private | Full security KB                        |
| `apps/slaops-docs/internal/testing/`         | Private | Test reports                            |
| `apps/slaops-docs/changelog/source/`         | Public  | Release changelog entries               |

`/internal/*` is protected by Cognito at the Amplify Hosting layer. Consult `apps/slaops-docs/public/docs/glossary.md` for domain terminology (OASpec, OASpecDoc, TopOp, APIUser, etc.).

### Claude Code doc tooling

| Skill      | When to use                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `/idea`    | Capture a raw idea or research note in `internal/platform/drafts/`                                    |
| `/design`  | Create a formal design doc — searches drafts for related ideas first, pre-fills lifecycle frontmatter |
| `/release` | Guided release: summarises git log → creates changelog entry → tags and pushes                        |

Active rules during any doc session:

- `.claude/rules/doc-tagging.md` — tag format and completeness
- `.claude/rules/doc-workflow.md` — doc tier placement, lifecycle transitions, idea absorption, quickstart sync

## Git Workflow

- Branch: `main` (primary development)
- Commits: Conventional Commits — `feat(scope): ...`, `fix(scope): ...`, etc.
- Full type→label mapping and recognised scopes: [CONVENTIONS.md](CONVENTIONS.md)
- Release process and checklist: [apps/slaops-docs/changelog/CLAUDE.md](apps/slaops-docs/changelog/CLAUDE.md)

## Test Resources

OpenAPI specs from [APIs-guru/openapi-directory](https://github.com/APIs-guru/openapi-directory) are used for testing. They are auto-installed via `postinstall`, gitignored, and excluded from IDE indexing.

```bash
pnpm run setup:test-resources   # Manual refresh
```

See [test-resources/README.md](test-resources/README.md) and [packages/slaops-private/CLAUDE.md](packages/slaops-private/CLAUDE.md) for the loader API.

## Conventions

See [CONVENTIONS.md](CONVENTIONS.md) for the full conventions reference.
