# Changelog Process

The changelog is a human-curated release log published at `/changelog` on the docs site. Each entry corresponds to one Git tag (`vX.Y.Z`) and documents the work that landed in that release.

## Mental Model

```
PRs merged into main
        ↓
[Git tag created: vX.Y.Z]   ← version boundary
        ↓
Maintainer groups PRs by label
        ↓
Changelog entry written as source/X.Y.Z.md
        ↓
Published on docs site under /changelog
```

The tag defines the boundary. The changelog entry describes what crossed it.

## Git Tagging Convention

Every release gets a SemVer tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

**SemVer rules:**
- `patch` (1.0.x) — bug fixes, no API changes
- `minor` (1.x.0) — new features, backward compatible
- `major` (x.0.0) — breaking changes to public APIs

## PR Label Scheme

Every PR should carry exactly one changelog label before release:

| Label | Changelog section |
|---|---|
| `pr: breaking change` | Breaking Changes |
| `pr: new feature` | New Features |
| `pr: bug fix` | Bug Fixes |
| `pr: performance` | Performance |
| `pr: documentation` | Documentation |
| `pr: maintenance` | Maintenance |
| `pr: internal` | *(omitted from changelog)* |
| `pr: dependencies` | *(omitted or collapsed)* |

PRs labeled `pr: internal` are not included in the public changelog.

## PR Title Convention

PR titles must follow the same **Conventional Commits** format defined in [`CONVENTIONS.md`](../../../../CONVENTIONS.md#git-commit-messages). The PR title is what appears in the changelog, so it must be correct even if individual branch commits are rough.

```
feat(portal): add service health dashboard
fix(relay): handle reconnect on network drop
perf(config): cache OASpec lookups to cut hot-path latency
docs(getting-started): add Docker setup section
chore(ci): upgrade Node to 22
feat(portal)!: remove deprecated v1 API endpoints
```

The type determines which changelog section the PR lands in — see the type→label mapping in `CONVENTIONS.md`.

## Writing a Changelog Entry

Create `changelog/source/X.Y.Z.md` — the filename must match the version exactly.

### Frontmatter

```yaml
---
mdx:
  format: md
date: 2026-04-15T12:00
---
```

- `date` is the release date in ISO 8601 (used for ordering on the index page)
- `mdx.format: md` keeps MDX processing off for plain Markdown content

### Structure

```markdown
---
mdx:
  format: md
date: 2026-04-15T12:00
---

# 1.2.0

<!-- truncate -->

### Breaking Changes

- **portal**: removed deprecated `v1` API endpoints — migrate to `v2` routes (#42, @dfutschik)

### New Features

- **relay**: add automatic reconnect with exponential backoff (#38, @dfutschik)
- **portal**: service health dashboard with SLA trend charts (#39, @dfutschik)

### Bug Fixes

- **client**: fix null pointer when response body is empty (#40, @dfutschik)

### Performance

- **opensearch**: cache OASpec lookups to reduce hot-path latency (#41, @dfutschik)

### Documentation

- Add Docker setup guide to getting-started (#37, @dfutschik)

### Maintenance

- Upgrade Node to 22 in CI (#36, @dfutschik)
```

**Rules:**
- `<!-- truncate -->` goes immediately after the `# X.Y.Z` heading — everything above the truncate marker appears in the changelog index preview
- Sections are only included if there is at least one entry for that release
- Each line references the PR number (`#42`) and author (`@handle`)
- Section order: Breaking Changes → New Features → Bug Fixes → Performance → Documentation → Maintenance

## Release Checklist

Before tagging a release:

1. Identify all PRs merged since the last tag: `git log vX.Y.Z..HEAD --oneline`
2. Ensure every PR has a changelog label
3. Create `changelog/source/X.Y.Z.md` grouping PRs by label into sections
4. Bump version in `package.json` if applicable
5. Create the Git tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
6. Verify the changelog renders correctly: `pnpm start` and visit `/changelog`

## Viewing Past Entries

All entries live in `changelog/source/`. The Docusaurus changelog plugin reads them and renders the index at `/changelog` and individual pages at `/changelog/X.Y.Z`.

The plugin is configured in `docusaurus.config.ts` under `plugins` with a `blogSidebarCount` of 5 (the five most recent releases appear in the sidebar).
