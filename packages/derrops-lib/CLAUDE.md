# derrops-lib

A type-safe TypeScript library for building sequential data-enrichment pipelines. Published to npm as `@derrops-lib`.

This package also lives as a standalone public GitHub repo (`derrickfutschik/derrops-lib`) synced via `git subtree` from the monorepo at `packages/derrops-lib/`.

## Structure

```
packages/derrops-lib/
├── src/
│   ├── index.ts           # public API re-exports
│   └── pipeline/          # core pipeline implementation
├── dist/                  # compiled output (gitignored, published to npm)
├── .github/
│   └── workflows/
│       └── publish.yml    # npm publish workflow (runs in standalone repo)
├── jest.config.js
├── package.json
└── tsconfig.json
```

## Development

```bash
npm install
npm run build        # compile TypeScript → dist/
npm test             # run Jest tests
npm run test:watch   # watch mode
npm run test:coverage
```

## Publishing to npm

Publishing is automated via GitHub Actions. The workflow triggers on version tags (`v*`) pushed to the **standalone repo** (`derrickfutschik/derrops-lib`).

### Required GitHub secret

In the standalone repo settings, add:

| Secret      | Value                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| `NPM_TOKEN` | An npm publish token (Automation or Publish type) with write access to `@derrops-lib` |

### Release workflow (from the monorepo)

1. **Bump the version** in `packages/derrops-lib/package.json`:

   ```bash
   # From packages/derrops-lib/
   npm run version:patch   # 1.0.0 → 1.0.1  (bug fixes)
   npm run version:minor   # 1.0.0 → 1.1.0  (new features, backwards-compatible)
   npm run version:major   # 1.0.0 → 2.0.0  (breaking changes)
   ```

   This updates `package.json` and creates a local git tag (`v1.0.1`, etc.).

2. **Commit and push** to the monorepo:

   ```bash
   git add packages/derrops-lib/package.json
   git commit -m "chore(derrops-lib): release v1.0.1"
   git push
   ```

3. **Push to the standalone repo** via subtree:

   ```bash
   pnpm subtree:push derrops-lib
   ```

   The standalone repo now has the version bump commit. Push the tag to it too:

   ```bash
   git push git@github.com:derrickfutschik/derrops-lib.git v1.0.1
   ```

4. **Workflow fires automatically** — the `publish.yml` workflow detects the `v*` tag, runs tests, builds, and publishes to npm.

### Manual / dry-run publish

Trigger the workflow manually from the Actions tab in the standalone repo. Set `dry_run: true` to preview without publishing.

## Package name note

The current npm name is `@derrops-lib`. For this to publish without scoped access restrictions, the package is published with `--access public`. If you want a properly scoped name (e.g. `@derrops/lib`), you would need an npm org `derrops` and update all import sites.
