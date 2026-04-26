# Git Workflow Rules

## Format before staging

Always run `pnpm run format:changed` **before** any `git add` call.

```bash
pnpm run format:changed   # format only modified/added/renamed files
git add <files>
git commit ...
```

**Never** stage files and commit without formatting first — unformatted code will fail CI and
pollute diffs with whitespace-only noise.

If you need to reformat the entire project (rare), use `pnpm run format` instead.
