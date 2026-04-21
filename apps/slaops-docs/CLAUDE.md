# SLAOps Documentation Site

Docusaurus 3.9.2 documentation site for the SLAOps platform, hosted at https://blog.SLAOps.com. Part of the SLAOps monorepo — use `pnpm` for all package management.

---

## Directory Layout

Content is split into two top-level trees signalling access intent:

```
apps/slaops-docs/
├── public/                        ← No auth required           → public/CLAUDE.md
│   ├── docs/                      ←   User-facing platform docs (Docusaurus preset)
│   └── security/                  ←   Customer security / compliance overview
│
├── internal/                      ← Cognito auth (Amplify layer) → internal/CLAUDE.md
│   ├── platform/
│   │   ├── design/                ←   ADRs & design docs        → design/CLAUDE.md
│   │   └── drafts/                ←   WIP ideas / research notes
│   ├── developer/code/            ←   Auto-copied monorepo READMEs
│   ├── devops/                    ←   Sprint planning, user stories
│   ├── security/                  ←   Full security KB
│   └── testing/                   ←   Test reports
│
├── changelog/source/              ← Public release changelog    → changelog/CLAUDE.md
├── blog/                          ← Public blog posts           → blog/CLAUDE.md
├── src/                           ←   Custom React components & plugins
└── static/                        ←   Static assets
```

**Key rules:**

- Drafts / WIP always go in `internal/platform/drafts/` — never in the public tree.
- Security is intentionally split: `public/security/` = customer-facing; `internal/security/` = full KB.
- `/internal/*` is the single auth choke-point (Amplify Hosting) — no Docusaurus-level auth needed.

---

## Plugin & Sidebar Mapping

| Plugin id           | Physical path               | URL route                   | Access  | Sidebar file                    |
| ------------------- | --------------------------- | --------------------------- | ------- | ------------------------------- |
| `docs` (preset)     | `public/docs/`              | `/docs`                     | Public  | `sidebars.ts`                   |
| `security-public`   | `public/security/`          | `/security`                 | Public  | `sidebars-security-public.ts`   |
| `platform-design`   | `internal/platform/design/` | `/internal/platform/design` | Private | `sidebars-platform-design.ts`   |
| `platform-drafts`   | `internal/platform/drafts/` | `/internal/platform/drafts` | Private | `sidebars-platform-drafts.ts`   |
| `developer`         | `internal/developer/code/`  | `/internal/developer`       | Private | `sidebars-developer.ts`         |
| `devops`            | `internal/devops/`          | `/internal/devops`          | Private | `sidebars-devops.ts`            |
| `security-internal` | `internal/security/`        | `/internal/security`        | Private | `sidebars-security-internal.ts` |
| `testing`           | `internal/testing/`         | `/internal/testing`         | Private | `sidebars-testing.ts`           |
| changelog (custom)  | `changelog/source/`         | `/changelog`                | Public  | —                               |
| blog                | `blog/`                     | `/blog`                     | Public  | —                               |

**Naming rule**: plugin `id` must match its sidebar key (e.g. `id: 'platform-design'` → sidebar key `'platform-design'`).

---

## Development

```bash
# Install from monorepo root
pnpm install --frozen-lockfile

# Start dev server (from this directory)
pnpm start                  # http://localhost:3000

# Build & serve
pnpm run build
pnpm run serve

# Utilities
pnpm run clear              # clear Docusaurus cache
pnpm run typecheck
pnpm docs:prepare           # re-copy monorepo READMEs into internal/developer/code/
```

The `prestart` script auto-clears cache if blog changes are detected.

---

## Deployment

AWS Amplify builds and deploys on push. Key files:

- `amplify.yml` — build spec
- `amplify-prebuild.sh` — Node.js version setup
- `amplify-build.sh` — build execution

Auth: Amplify Hosting access rule protects `/internal/*` with Cognito. All other routes are public.

---

## Tech notes

- **Broken links**: strict mode — throws on build.
- **Math**: remark-math + rehype-katex.
- **Code imports**: remark-code-import.
- **Mermaid**: see `.claude/rules/mermaid-authoring.md` for authoring rules (silent failures on violations).
- **Admonition titles**: use bracket syntax — `:::tip[My Title]`, not `:::tip My Title` (space syntax is Docusaurus 2 and silently fails in 3.x).
- **React 19**, **Node.js >= 22**, **pnpm 8.15.4+**.

---

## Monorepo context

- Always use `pnpm` (not npm/yarn).
- Build shared deps before building docs: `pnpm --filter @slaops/private run build && pnpm --filter @slaops/public run build`.
- Install dependencies from the monorepo root (`../../`).
