# Conventions

- SQL Table Names & Columns are in snake_case
- SQL Table Names should be singular

## Git Commit Messages

Commit messages use **Conventional Commits** format. This maps directly to changelog labels so that every commit traces cleanly to a release entry.

### Format

```
<type>(<scope>): <description>

[optional body — what changed and why, not how]

[optional footer — BREAKING CHANGE: ..., Closes #N]
```

- Subject line ≤ 72 characters, imperative mood, no trailing period
- Body and footer are optional; use them when the subject alone is insufficient
- Use `pnpm commit` (AI-assisted) or write manually following these rules

### Types → Changelog mapping

| Type | Changelog label | Changelog section |
|---|---|---|
| `feat` | `pr: new feature` | New Features |
| `fix` | `pr: bug fix` | Bug Fixes |
| `perf` | `pr: performance` | Performance |
| `docs` | `pr: documentation` | Documentation |
| `refactor` | `pr: maintenance` | Maintenance |
| `chore` | `pr: maintenance` | Maintenance |
| `test` | `pr: internal` | *(omitted)* |
| `ci` | `pr: internal` | *(omitted)* |
| `build` | `pr: internal` | *(omitted)* |

**Breaking changes** — append `!` after the type (or scope):

```
feat(portal)!: remove v1 API endpoints
```

And add a `BREAKING CHANGE:` footer describing the migration path:

```
BREAKING CHANGE: v1 routes have been removed. Use /api/v2/* equivalents.
```

This maps to the `pr: breaking change` label and the Breaking Changes section.

### Scopes

Use the package or app name as the scope. Recognised scopes:

| Scope | Maps to |
|---|---|
| `portal` | `apps/slaops-portal` |
| `docs` | `apps/slaops-docs` |
| `relay` | relay feature area |
| `client` | `packages/slaops-client` |
| `axios` | `packages/slaops-client-nodejs-axios` |
| `config` | `packages/slaops-config` |
| `infra` | `packages/slaops-infra` |
| `backend` | `packages/slaops-backend` |
| `private` | `packages/slaops-private` |
| `public` | `packages/slaops-public` |
| `ci` | `.github/` or build tooling |
| `deps` | dependency updates |

Scope is optional when the change genuinely spans multiple areas with no clear owner.

### Examples

```
feat(portal): add service health dashboard with SLA trend charts
fix(relay): handle reconnect on network drop after idle timeout
perf(config): cache OASpec lookups to reduce hot-path latency
docs(getting-started): add Docker setup section
chore(deps): upgrade vitest to 2.1.0
refactor(client): simplify interceptor attachment logic
ci: add path-based conditional builds for docs and portal
feat(portal)!: remove deprecated v1 API endpoints
```

### Multi-commit PRs

Individual commits on a feature branch do not need to be perfect — they are squash-merged. The **PR title** is what appears in the changelog, so it must follow these conventions precisely. Commits on the branch can be more granular (e.g. `wip:`, `fixup:`) as long as the final squash title is correct.

### AI commit helper

`pnpm commit` runs `scripts/ai-commit.sh`, which generates a message following these conventions and opens it in an editor for review before committing.

## Mermaid Diagrams

### Node label text

- `\n` does **not** create a newline — it renders as the literal characters `\n`. Never use it.
- To create a real line break inside a node label, use `<br/>` inside a quoted string:
  ```
  A["line one<br/>line two"]
  ```
- Any node label containing special characters **must** be wrapped in double quotes:
  ```
  A["POST /api/foo (201)"]
  ```
- Special characters that **break unquoted labels** and require quoting:
  - `(` `)` — parentheses
  - `:` — colon (also used in edge label syntax)
  - `#` — hash
  - `>` — angle bracket
  - `-` at the start of a word — can be misread as an arrow fragment
- Do not use double quotes (`"`) inside an already-quoted label — there is no escape sequence; rephrase to avoid them.
- Backticks create a **monospace/code styled** label (supported in newer Mermaid): `` A[`code style`] ``

### Node IDs

- Node IDs must be alphanumeric or use underscores — no spaces, hyphens, or punctuation.
- Keep IDs short and descriptive; they are not shown in the rendered diagram unless there is no label.

### Edge labels

- Edge labels go between pipes: `A -->|label text| B`
- Colons and parentheses in edge labels also require quoting the whole edge label in some renderers — prefer plain words.

### Subgraphs

- The subgraph title must be on the same line as the `subgraph` keyword:
  ```
  subgraph Customer Infrastructure
      A
  end
  ```
- Subgraph titles do not support `<br/>` — keep them to a single short line.

### General

- Docusaurus uses `@docusaurus/theme-mermaid`; always use a fenced code block tagged `mermaid`.
- Comments use `%%`: `%% this is a comment`
- Prefer `flowchart` over `graph` — `flowchart` is the current syntax and supports more features.
- Declare direction on the first line: `flowchart TD` (top-down), `flowchart LR` (left-right).
- Keep node labels short — long labels cause layout overflow on narrow screens.
