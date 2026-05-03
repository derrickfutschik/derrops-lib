# /release — Create a Release

Guides the full release process: identify changes, create the changelog entry, tag the commit, and push.

## When to use

Use `/release [version]` when you are ready to cut a new release. If the version is omitted, Claude will determine the suggested SemVer bump based on the commits since the last tag.

## Steps

### 1. Identify changes since last tag

Run:

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

Group the output by conventional commit type:

- `feat` → New Features
- `fix` → Bug Fixes
- `perf` → Performance
- `docs` → Documentation
- `refactor` / `chore` / `build` / `ci` → Maintenance
- Any commit with `!` or `BREAKING CHANGE` → Breaking Changes

Present the grouped list to the user.

### 2. Confirm the version number

If no version was provided, suggest one based on SemVer rules:

- **patch** — bug fixes only, no API changes
- **minor** — new features, backward compatible
- **major** — breaking changes to the public API

Ask: "Based on these changes, I suggest version X.Y.Z (patch|minor|major bump). Confirm, or provide a version?"

### 3. Create the changelog source file

Create `apps/derrops-docs/changelog/source/X.Y.Z.md` with this structure:

```markdown
---
mdx:
  format: md
date: { YYYY-MM-DDTHH:MM }
---

# X.Y.Z

<!-- truncate -->

## Breaking Changes

- **scope**: description (#PR, @author)

## New Features

- **scope**: description (#PR, @author)

## Bug Fixes

- **scope**: description (#PR, @author)

## Performance

- **scope**: description (#PR, @author)

## Documentation

- **scope**: description (#PR, @author)

## Maintenance

- **scope**: description (#PR, @author)
```

Omit sections that have no entries. The `<!-- truncate -->` marker must appear immediately after the `# X.Y.Z` heading.

### 4. Ask the user to review

Tell the user: "Please review `apps/derrops-docs/changelog/source/X.Y.Z.md` before I tag. Run `pnpm start` in `apps/derrops-docs` to verify rendering if needed."

Wait for confirmation before proceeding.

### 5. Tag and push

On user confirmation:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Confirm: "Tag vX.Y.Z pushed. The changelog will publish on the next Amplify deploy."

## Reference

- Full changelog format and PR label scheme: `apps/derrops-docs/changelog/CLAUDE.md`
- Commit type → changelog section mapping: `CONVENTIONS.md`
