# Derrops Platform

A monorepo for the Derrops platform — a DevOps solution for monitoring, logging, and analysing HTTP requests and API usage across your applications.

Derrops provides: HTTP request/response monitoring, OpenAPI spec validation, API performance metrics, SLA compliance tracking, cost analysis, and real-time alerts.

## Monorepo Structure

```
derrops-platform/
├── packages/
│   ├── derrops-private/            # @derrops/private    – Core types & utilities (private, no deps)
│   ├── derrops-public/             # @derrops/public     – Shared utilities (public npm)
│   ├── derrops-config/             # @derrops/config     – Zod-validated config management
│   ├── derrops-client/             # @derrops/client     – Base HTTP client (public npm)
│   ├── derrops-client-nodejs-axios/# derrops-client-nodejs-axios – Axios interceptor client (public npm)
│   ├── derrops-infra/              # @derrops/infra      – AWS CDK stacks (DB, VPC, Auth, API GW)
│   ├── derrops-backend/            # @derrops/backend    – AWS Amplify Lambda function deployment
│   └── derrops-test/               # @derrops/test       – Cross-package integration tests
│
├── apps/
│   ├── derrops-docs/               # Docusaurus docs site → apps/derrops-docs/CLAUDE.md
│   ├── derrops-portal/             # React monitoring portal → apps/derrops-portal/CLAUDE.md
│   └── derrops-cloud/              # NestJS backend API → apps/derrops-cloud/CLAUDE.md
│
└── scripts/
    └── ai-commit.sh               # AI-powered commit message generator (pnpm commit)
```

### Package build order (dependency graph)

```
@derrops/private  (no deps)
       ↓
@derrops/public · @derrops/config (standalone, zod only)
       ↓
@derrops/client
       ↓
derrops-client-nodejs-axios
       ↓
@derrops/test  (dev deps on all — built last)
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
| `@derrops/private`            | Core types, interfaces, shared constants      | [CLAUDE.md](packages/derrops-private/CLAUDE.md)             |
| `@derrops/public`             | Reusable utilities (HTTP helpers, transforms) | [CLAUDE.md](packages/derrops-public/CLAUDE.md)              |
| `@derrops/config`             | Zod-validated config, dot-notation access     | [CLAUDE.md](packages/derrops-config/CLAUDE.md)              |
| `@derrops/client`             | Base Derrops HTTP client class                 | [CLAUDE.md](packages/derrops-client/CLAUDE.md)              |
| `derrops-client-nodejs-axios` | Axios interceptor client for Node.js          | [CLAUDE.md](packages/derrops-client-nodejs-axios/CLAUDE.md) |
| `@derrops/infra`              | CDK stacks: VPC, Aurora, Cognito, API GW      | [CLAUDE.md](packages/derrops-infra/CLAUDE.md)               |
| `@derrops/backend`            | Amplify Lambda function deployment            | [CLAUDE.md](packages/derrops-backend/CLAUDE.md)             |
| `@derrops/test`               | Cross-package integration tests               | [CLAUDE.md](packages/derrops-test/CLAUDE.md)                |

## Apps — quick reference

| App             | Purpose                                                | Details                                   |
| --------------- | ------------------------------------------------------ | ----------------------------------------- |
| `derrops-docs`   | Docusaurus site at https://blog.Derrops.com (port 3000) | [CLAUDE.md](apps/derrops-docs/CLAUDE.md)   |
| `derrops-portal` | React monitoring dashboard (port 8080)                 | [CLAUDE.md](apps/derrops-portal/CLAUDE.md) |
| `derrops-cloud`  | NestJS backend API (deployed as Lambda)                | [CLAUDE.md](apps/derrops-cloud/CLAUDE.md)  |

## Key Conventions

### Run Prettier after changes

After making any code changes, run `pnpm run format:changed` to format only modified/added/renamed files before committing. Use `pnpm run format` only when you need to reformat the entire project.

### Never use `process.env` directly

Always use `@derrops/config`. See [packages/derrops-config/CLAUDE.md](packages/derrops-config/CLAUDE.md) for the full API.

```typescript
// ✅
import { config } from '@derrops/config'
const port = config['app.port']

// ❌
const port = process.env.PORT
```

### No magic numbers or hardcoded values

Every configurable value (limits, sizes, timeouts, names, prefixes) must be a named property in `packages/derrops-config/src/config.ts` with a JSDoc comment. See [packages/derrops-config/CLAUDE.md](packages/derrops-config/CLAUDE.md).

### AWS resource names, IAM policies, and CDK tagging

Never write an AWS resource name, CloudFormation export name, CDK tag value, or IAM policy ARN
as a plain string. All names are generated with `DerropsConventions` (from `@derrops-conventions`)
following an `org → domain → service` nesting pattern. Define names in the package where they're
used; elevate to `packages/derrops-config/src/` only when shared across multiple packages.

IAM policies must also be generated from the same convention — never hardcode ARNs or action lists.
Use `.staticPolicy()` for explicit declarations or `.dynamicPolicy()` for session-recorded policies.
CDK tags are applied via `applyTags((k, v) => Tags.of(this).add(k, v))`.

See `.claude/rules/resource-naming.md` for the full pattern, decision tree, IAM policy generation rules, and examples.

### TypeScript path mappings

`paths` in `tsconfig.base.json` do **not** merge into child configs — each child must redeclare the paths it needs. See the path mapping convention in individual `tsconfig.json` files. Current cross-module mapping: `@derrops/cloud/*` → `apps/derrops-cloud/src/*`.

### DynamoDB vs Aurora

Use DynamoDB **only** for ultra-latency-sensitive hot paths (e.g. OASpec lookups during log enrichment). Default to Aurora Serverless v2 (PostgreSQL) for everything else.

### Design-Code Sync

When a code file implements a formal design document, add a `@designDoc` tag in its file-level JSDoc block referencing the design doc path (monorepo-root-relative). When editing a tagged file, check whether the change requires updating the linked design doc(s). See `.claude/rules/design-sync.md` for the full convention.

## Development Workflow

Follow these steps for any feature, fix, or significant change:

1. **Design** — write a design doc in `apps/derrops-docs/internal/platform/design/`
2. **Plan** — store the implementation plan in `apps/derrops-docs/plan/` (`.md`, Docusaurus format); cross-reference the design
3. **Implement** — follow the plan; add `@designDoc` tags to implementing files and `implements:` frontmatter to the design doc (see `.claude/rules/design-sync.md`); set `status: implemented` once shipped
4. **Document** — add/update public docs in `apps/derrops-docs/public/docs/`
5. **Commit** — Conventional Commits format (see [CONVENTIONS.md](CONVENTIONS.md))
6. **Release** — tag `vX.Y.Z`, add `apps/derrops-docs/changelog/source/X.Y.Z.md`

### Documentation locations

| Location                                     | Access  | Purpose                                 |
| -------------------------------------------- | ------- | --------------------------------------- |
| `apps/derrops-docs/public/docs/`              | Public  | User-facing platform docs               |
| `apps/derrops-docs/public/security/`          | Public  | Customer security / compliance overview |
| `apps/derrops-docs/internal/platform/design/` | Private | ADRs, design docs                       |
| `apps/derrops-docs/internal/platform/drafts/` | Private | WIP ideas, research notes               |
| `apps/derrops-docs/internal/developer/code/`  | Private | Auto-copied monorepo READMEs            |
| `apps/derrops-docs/internal/devops/`          | Private | Sprint planning, user stories           |
| `apps/derrops-docs/internal/security/`        | Private | Full security KB                        |
| `apps/derrops-docs/internal/testing/`         | Private | Test reports                            |
| `apps/derrops-docs/changelog/source/`         | Public  | Release changelog entries               |

`/internal/*` is protected by Cognito at the Amplify Hosting layer. Consult `apps/derrops-docs/public/docs/glossary.md` for domain terminology (OASpec, OASpecDoc, TopOp, APIUser, etc.).

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
- Release process and checklist: [apps/derrops-docs/changelog/CLAUDE.md](apps/derrops-docs/changelog/CLAUDE.md)

## Test Resources

OpenAPI specs from [APIs-guru/openapi-directory](https://github.com/APIs-guru/openapi-directory) are used for testing. They are auto-installed via `postinstall`, gitignored, and excluded from IDE indexing.

```bash
pnpm run setup:test-resources   # Manual refresh
```

See [test-resources/README.md](test-resources/README.md) and [packages/derrops-private/CLAUDE.md](packages/derrops-private/CLAUDE.md) for the loader API.

## Conventions

See [CONVENTIONS.md](CONVENTIONS.md) for the full conventions reference.
