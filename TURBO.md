# Turborepo Setup

This monorepo uses [Turborepo](https://turbo.build/) to manage build pipelines, caching, and task orchestration across packages and applications.

## What is Turborepo?

Turborepo is a high-performance build system for JavaScript/TypeScript monorepos that:

- **Speeds up builds** with intelligent caching
- **Parallelizes tasks** across packages
- **Manages dependencies** between tasks automatically
- **Provides incremental builds** - only rebuilds what changed

## Installation

Turbo is already installed as a dev dependency in this monorepo:

```json
{
  "devDependencies": {
    "turbo": "^2.6.1"
  }
}
```

No additional installation is needed.

## Configuration

### turbo.json

The main configuration file at the root defines task pipelines:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**", "build/**", ".docusaurus/**"],
      "env": ["NODE_ENV", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["NODE_OPTIONS"]
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    },
    "test:coverage": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["NODE_OPTIONS"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

#### Key Configuration Concepts

**dependsOn**: Defines task ordering

- `"^build"` means "run the `build` task in dependencies first"
- Ensures packages build in the correct order (core → lib → client → axios-client)

**outputs**: Files/directories to cache

- Turbo caches these outputs to skip rebuilding when nothing changed
- Glob patterns supported (e.g., `dist/**`, `!.next/cache/**`)

**cache**: Whether to cache task results

- `false` for long-running dev servers and watch tasks
- `true` (default) for builds, tests, and other deterministic tasks

**persistent**: Marks long-running tasks

- Set to `true` for dev servers, watch modes
- Tells Turbo not to exit when this task is running

**env**: Environment variables that affect the task

- Changes to these variables invalidate the cache
- Ensures rebuilds when environment changes

## Usage

### Basic Commands

All root-level npm scripts use Turbo:

```bash
# Build all packages and apps (in dependency order)
pnpm run build

# Run dev servers for all packages and apps
pnpm run dev

# Run tests across all packages
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run linting
pnpm run lint

# Type checking
pnpm run typecheck

# Clean build artifacts
pnpm run clean
```

### Filtering by Package

Run tasks for specific packages using `--filter`:

```bash
# Build only @slaops/private
pnpm exec turbo run build --filter=@slaops/private

# Build multiple packages
pnpm exec turbo run build --filter=@slaops/private --filter=@slaops/public

# Build everything in packages/ directory
pnpm exec turbo run build --filter=./packages/*

# Build only apps
pnpm exec turbo run build --filter=./apps/*
```

### Advanced Filtering

```bash
# Build a package and its dependencies
pnpm exec turbo run build --filter=...@slaops/client

# Build a package and its dependents
pnpm exec turbo run build --filter=@slaops/private...

# Build changed packages since last commit
pnpm exec turbo run build --filter=[HEAD^1]

# Build packages that changed in this branch
pnpm exec turbo run build --filter=[main...HEAD]
```

### Parallel Execution

Turbo automatically runs tasks in parallel when safe:

```bash
# Run tests in all packages simultaneously (where possible)
pnpm exec turbo run test

# Limit parallelism
pnpm exec turbo run build --concurrency=2
```

### Cache Management

```bash
# Force rebuild (ignore cache)
pnpm exec turbo run build --force

# See cache hits/misses
pnpm exec turbo run build --summarize

# Clear the cache
rm -rf .turbo
```

## How Build Order Works

Turbo respects the dependency graph:

```
@slaops/private (no dependencies)
    ↓
@slaops/public (depends on core)
    ↓
@slaops/client (depends on core)
    ↓
slaops-client-nodejs-axios (depends on core, client, lib)
```

When you run `pnpm run build`, Turbo:

1. Analyzes `package.json` dependencies
2. Builds `@slaops/private` first
3. Builds `@slaops/public` and `@slaops/client` in parallel (both only depend on core)
4. Builds `slaops-client-nodejs-axios` last (depends on all others)
5. Builds apps (`slaops-docs`, `slaops-portal`) after packages

## Caching Explained

### Cache Keys

Turbo creates cache keys based on:

- **Task inputs**: Source files, dependencies, configuration files
- **Environment variables**: Specified in `env` array
- **Task dependencies**: Hash of dependency task outputs
- **Git state**: For `--filter=[HEAD]` patterns

### Cache Outputs

When a task completes, Turbo caches:

- Files in `outputs` directories
- Terminal output (logs)
- Exit code

### Cache Hits

On subsequent runs, if the cache key matches:

- Turbo restores cached files
- Replays terminal output
- Skips actual execution
- Shows `cache hit, replaying logs`

### Example

```bash
# First run - builds everything
$ pnpm exec turbo run build
@slaops/private:build: cache miss, executing...
@slaops/public:build: cache miss, executing...
# ... builds run

# Second run - uses cache
$ pnpm exec turbo run build
@slaops/private:build: cache hit, replaying logs...
@slaops/public:build: cache hit, replaying logs...
# ... instant results

# After changing core/src/index.ts
$ pnpm exec turbo run build
@slaops/private:build: cache miss, executing...      # Rebuilds (changed)
@slaops/public:build: cache miss, executing...       # Rebuilds (dependency changed)
@slaops/client:build: cache miss, executing...    # Rebuilds (dependency changed)
# ... only affected packages rebuild
```

## Remote Caching

For team collaboration, enable remote caching:

```bash
# Link to Vercel (optional)
pnpm exec turbo login
pnpm exec turbo link
```

This shares cache across:

- Team members
- CI/CD pipelines
- Different machines

**Current status**: Remote caching is disabled by default.

## Task Scripts

Each package should have scripts matching the tasks in `turbo.json`:

```json
{
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts --clean",
    "dev": "tsc -w",
    "test": "NODE_OPTIONS=--experimental-vm-modules jest",
    "test:watch": "NODE_OPTIONS=--experimental-vm-modules jest --watch",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

Not all packages need all scripts. Turbo will skip packages that don't have a matching script.

## Performance Tips

1. **Define outputs precisely**: Only cache what's necessary

   ```json
   "outputs": ["dist/**", "!dist/**/*.map"]
   ```

2. **Use persistent for dev tasks**: Prevents Turbo from killing long-running processes

   ```json
   "dev": { "persistent": true, "cache": false }
   ```

3. **Leverage filtering**: Don't run tasks for unchanged packages

   ```bash
   pnpm exec turbo run test --filter=[HEAD^1]
   ```

4. **Parallelize when possible**: Remove unnecessary `dependsOn` constraints

   ```json
   "lint": { "outputs": [] }  // No dependsOn needed
   ```

5. **Use remote caching**: Share cache across team and CI

## Troubleshooting

### Cache Issues

If you suspect cache corruption:

```bash
# Clear Turbo cache
rm -rf .turbo

# Force rebuild
pnpm exec turbo run build --force
```

### Build Order Issues

Ensure dependencies are declared in `package.json`:

```json
{
  "dependencies": {
    "@slaops/private": "*"
  }
}
```

Turbo uses these to determine build order.

### Environment Variables

If builds are inconsistent, add env vars to `turbo.json`:

```json
"build": {
  "env": ["NODE_ENV", "API_KEY", "OTHER_VAR"]
}
```

This ensures cache invalidation when these change.

### Debugging

Enable verbose logging:

```bash
pnpm exec turbo run build --verbosity=2
```

Generate a build graph:

```bash
pnpm exec turbo run build --graph
```

This opens a visualization showing task dependencies.

## Migration from Manual Scripts

Before Turbo, the root `package.json` had:

```json
{
  "scripts": {
    "build": "pnpm -r --filter @slaops/private run build && pnpm -r --filter @slaops/public run build && ..."
  }
}
```

After Turbo:

```json
{
  "scripts": {
    "build": "turbo run build"
  }
}
```

Benefits:

- No manual dependency ordering
- Automatic parallelization
- Built-in caching
- Better error handling
- Cleaner scripts

## Further Reading

- [Turborepo Docs](https://turbo.build/repo/docs)
- [Task Configuration](https://turbo.build/repo/docs/reference/configuration#tasks)
- [Filtering](https://turbo.build/repo/docs/reference/run#--filter)
- [Caching](https://turbo.build/repo/docs/core-concepts/caching)
- [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)

## Summary

Turborepo is now managing all build tasks in this monorepo:

- ✅ Installed and configured
- ✅ All scripts updated to use `turbo run`
- ✅ Dependency ordering automated
- ✅ Caching enabled for faster builds
- ✅ Parallel execution where possible
- ✅ Ready for remote caching (optional)

Run `pnpm run build` to see Turbo in action!
