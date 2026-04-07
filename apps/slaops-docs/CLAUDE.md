# SLAOps Documentation Site

This is a Docusaurus documentation site for the SLAOps platform, hosted at https://blog.SLAOps.com.

**Note**: This is part of the SLAOps monorepo. Use `pnpm` for all package management operations for consistency across the monorepo.

## Overview

The SLAOps documentation provides comprehensive guides for the SLAOps platform, a DevOps engineering solution focused on:

- HTTP API monitoring and SLA compliance
- Cloud relay architecture and local development relay
- OpenAPI specification indexing and validation
- Cost analysis for API usage
- Aegis policy engine and credential injection

---

## Directory Structure & Access Model

Content is split into two top-level trees whose names signal access intent:

```
apps/slaops-docs/
├── public/                        ← No auth required
│   ├── docs/                      ←   User-facing platform docs (Docusaurus preset)
│   └── security/                  ←   Customer security / compliance overview
│
├── internal/                      ← Cognito auth required — protected at Amplify layer
│   ├── platform/
│   │   ├── design/                ←   Implemented platform design records (ADRs)
│   │   └── drafts/                ←   WIP ideas and research notes
│   ├── developer/
│   │   └── code/                  ←   Auto-copied monorepo READMEs (see scripts/copy-code-readmes.mjs)
│   ├── devops/                    ←   Sprint planning, user stories
│   ├── security/                  ←   Full security KB (threat models, pen-tests, compliance)
│   └── testing/                   ←   Test reports
│
├── changelog/                     ← Public release changelog (custom plugin)
├── blog/                          ← Public blog posts
├── src/                           ←   Custom React components & plugins (changelog)
└── static/                        ←   Static assets
```

### Naming conventions

| Convention | Rule |
|---|---|
| `public/` prefix | Open access — no authentication |
| `internal/` prefix | Requires Cognito login (enforced at Amplify Hosting layer) |
| Section dirs are lowercase-hyphenated | `platform/`, `developer/`, `devops/` |
| Sidebar file names mirror section names | `sidebars-platform-design.ts`, `sidebars-developer.ts` |
| Plugin `id` matches sidebar key | `id: 'platform-design'` → sidebar key `'platform-design'` |
| Drafts / WIP always go in `internal/platform/drafts/` | Never in the public tree |
| Security split is intentional | `public/security/` = customer-facing; `internal/security/` = full KB |

### Permission management

The `/internal/*` URL prefix is the single choke-point. Protect it at **Amplify Hosting** (access control rules in the Amplify Console or `amplify.yml`) — no Docusaurus-level auth is needed.

Public routes: `/docs`, `/security`, `/blog`, `/changelog`
Private routes: `/internal/**` (all sub-paths)

---

## Docusaurus Plugin Mapping

| Plugin id | Physical path | URL route | Access |
|---|---|---|---|
| `docs` (preset) | `public/docs/` | `/docs` | Public |
| `security-public` | `public/security/` | `/security` | Public |
| `platform-design` | `internal/platform/design/` | `/internal/platform/design` | Private |
| `platform-drafts` | `internal/platform/drafts/` | `/internal/platform/drafts` | Private |
| `developer` | `internal/developer/code/` | `/internal/developer` | Private |
| `devops` | `internal/devops/` | `/internal/devops` | Private |
| `security-internal` | `internal/security/` | `/internal/security` | Private |
| `testing` | `internal/testing/` | `/internal/testing` | Private |
| changelog (custom) | `changelog/source/` | `/changelog` | Public |
| blog | `blog/` | `/blog` | Public |

### Sidebar file names

| File | Sidebar key | Used by plugin |
|---|---|---|
| `sidebars.ts` | `tutorialSidebar` | `docs` (preset) |
| `sidebars-security-public.ts` | `security-public` | `security-public` |
| `sidebars-platform-design.ts` | `platform-design` | `platform-design` |
| `sidebars-platform-drafts.ts` | `platform-drafts` | `platform-drafts` |
| `sidebars-developer.ts` | `developer` | `developer` |
| `sidebars-devops.ts` | `devops` | `devops` |
| `sidebars-security-internal.ts` | `security-internal` | `security-internal` |
| `sidebars-testing.ts` | `testing` | `testing` |

---

## Key Features

- **Docusaurus 3.9.2** with future v4 compatibility enabled
- **Mermaid diagrams** support via `@docusaurus/theme-mermaid`

  **Mermaid authoring rules** (violations cause silent render failures):
  - Always quote participant/actor labels that contain special characters such as parentheses, brackets, or colons — e.g. `participant Foo as "Foo Service (v2)"` not `participant Foo as Foo Service (v2)`.
  - Keep node/participant IDs simple identifiers (letters, digits, underscores) — put human-readable text in the `as "..."` alias.
  - Never use semicolons (`;`) inside message labels — Mermaid treats them as statement terminators, which causes a parse error on the following line. Use a comma or em dash instead.
- **Math equations** support via remark-math and rehype-katex
- **Code imports** via remark-code-import plugin
- **Custom changelog** plugin for release tracking
- **Dark/light mode** with system preference detection
- **RSS/Atom feeds** for blog and changelog
- **React 19** for modern component support

---

## Development

### Prerequisites

- Node.js >= 22.0.0 (specified in .nvmrc and package.json engines)
- pnpm 8.15.4 or compatible version (monorepo package manager)

### Initial Setup

Since this is part of a monorepo, dependencies must be installed from the monorepo root:

```bash
# From monorepo root (../../)
pnpm install --frozen-lockfile

# Build shared dependencies that slaops-docs depends on
pnpm --filter @slaops/private run build
pnpm --filter @slaops/public run build
```

### Local Development

```bash
# From apps/slaops-docs directory
pnpm start

# The site will be available at http://localhost:3000
```

The `prestart` script automatically clears the cache if blog changes are detected.

### Building

```bash
# From apps/slaops-docs directory
pnpm run build

# Serve built site locally
pnpm run serve
```

### Other Commands

```bash
# Clear Docusaurus cache
pnpm run clear

# Type checking
pnpm run typecheck

# Generate heading IDs for docs
pnpm run write-heading-ids

# Extract translation strings
pnpm run write-translations
```

---

## Content Management

### Public documentation (`public/docs/`)

User-facing platform documentation. Sidebar is auto-generated from the filesystem.

Key files:
- `intro.md` — Platform overview
- `getting-started.md` — Install CLI, connect relay, run first test
- `glossary.md` — Domain term definitions
- `quickstart/` — Step-by-step guided setup

### Public security (`public/security/`)

Customer-facing security posture document. Add docs here that customers can read during vendor evaluation. Keep sensitive details (threat models, pen-test reports) in `internal/security/` instead.

### Platform design (`internal/platform/design/`)

Completed architecture decision records and design docs. Sidebar is auto-generated.

### Platform drafts (`internal/platform/drafts/`)

WIP ideas, research notes, and anything not yet ready to be a formal design doc. Previously `notes/`.

### Developer (`internal/developer/code/`)

Auto-copied from monorepo READMEs. **Do not edit files here directly** — edit the source README.md in the relevant app or package.

- **Script**: `scripts/copy-code-readmes.mjs`
- **When**: Run automatically before `pnpm start` and `pnpm build`; or `pnpm docs:prepare` to refresh.
- **Sidebar**: `sidebars-developer.ts`. To add a new README, add its path to `COPY_LIST` in the script and the doc id to the sidebar.

### DevOps (`internal/devops/`)

Sprint planning and user story documentation. Sidebar is manually defined in `sidebars-devops.ts`.

### Internal security (`internal/security/`)

Full security knowledge base — threat models, pen-test results, compliance evidence, incident runbooks.

### Testing (`internal/testing/`)

Test reports and quality metrics. Add subdirectories for `unit/`, `integration/`, `e2e/` as needed.

### Blog (`blog/`)

Blog posts follow Docusaurus blog conventions with frontmatter:
- Authors defined in `blog/authors.yml`
- Tags defined in `blog/tags.yml`
- Posts organised by date in subdirectories

### Changelog (`changelog/`)

Custom changelog plugin for release tracking:
- Located at `src/plugins/changelog/`
- Available at `/changelog`
- Source entries in `changelog/source/`
- Configured with 5 recent releases in sidebar

---

## Deployment

### AWS Amplify

The site is deployed using AWS Amplify:

- **amplify.yml** — Build configuration
- **amplify-prebuild.sh** — Pre-build setup (Node.js version, etc.)
- **amplify-build.sh** — Build execution script

AWS Amplify automatically builds and deploys the site when changes are pushed to the repository.

**Auth configuration**: Add an Amplify Hosting access rule to protect the `/internal/*` path prefix with Cognito authentication. All other routes remain public.

---

## Configuration

### Main Config (`docusaurus.config.ts`)

Key settings:
- **Title**: "SLAOps"
- **URL**: https://blog.SLAOps.com
- **Broken links**: throws errors (strict mode)
- Each content section is a separate `@docusaurus/plugin-content-docs` instance

### Theme

- Prism syntax highlighting (GitHub light, Dracula dark)
- Custom CSS in `src/css/custom.css`
- KaTeX stylesheet for math rendering

---

## Monorepo Context

This documentation site is part of the SLAOps monorepo. When working here:

- Always use `pnpm` for package management
- Build shared dependencies before building slaops-docs
- Install dependencies from the monorepo root
- Use pnpm workspace filters for targeted operations

---

## License

Dual-licensed under ISC OR GPL-3.0

## Author

SLAOps@SLAOps.com

## Links

- **Live Site**: https://blog.SLAOps.com
- **GitHub**: https://github.com/derrickfutschik/slaops-platform
