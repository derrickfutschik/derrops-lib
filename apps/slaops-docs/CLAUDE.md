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

## Project Structure

```
apps/slaops-docs/
├── docs/              # Main documentation content
├── src/
│   ├── design/        # Main Design of the Platform (Internal for Architecture Decision Records)
│   ├── docs/          # Public Documentation for the Platform
│   ├── devops/        # Sprint and User Story documentation
│   └── code/          # Implementation detail documentation for the SLAOps platform monorepo, developer day-to-day focused.
├── blog/              # Blog posts
├── changelog/         # Changelog entries
├── src/
│   ├── components/    # Custom React components
│   ├── css/           # Custom styling
│   ├── pages/         # Custom pages
│   └── plugins/       # Custom Docusaurus plugins (e.g., changelog)
├── static/            # Static assets (images, favicons)
├── docusaurus.config.ts  # Main configuration
└── sidebars.ts        # Sidebar navigation structure
```

## Key Features

- **Docusaurus 3.9.2** with future v4 compatibility enabled
- **Mermaid diagrams** support via `@docusaurus/theme-mermaid`
- **Math equations** support via remark-math and rehype-katex
- **Code imports** via remark-code-import plugin
- **Custom changelog** plugin for release tracking
- **Dark/light mode** with system preference detection
- **RSS/Atom feeds** for blog and changelog
- **React 19** for modern component support

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

## Content Management

### Documentation (docs/)

Documentation files are in Markdown/MDX format. The sidebar structure is defined in `sidebars.ts`.

Key documentation areas:

- **intro.md** - Platform overview and feature summary
- **getting-started.md** - Install CLI, connect relay, run first test, add Aegis
- **glossary.md** - Domain term definitions (OASpec, TopOp, relay, Aegis, etc.)
- **archiecture-planes.md** - Enterprise plane architecture (portal, relay, Aegis)
- **environment.md** - Environment variables and configuration reference
- **oaspec-bucket.md** - OASpec bucket: indexing OpenAPI specifications
- **plans.md** - SLAOps plan tiers and feature availability
- **byok.md** - Bring Your Own Key: customer-managed encryption
- **supported-logs.md** - Supported log sources and ingestion formats

### Blog (blog/)

Blog posts follow Docusaurus blog conventions with frontmatter:

- Authors defined in `blog/authors.yml`
- Tags defined in `blog/tags.yml`
- Posts organized by date in subdirectories

### Changelog (changelog/)

Custom changelog plugin for release tracking:

- Located at `src/plugins/changelog/`
- Available at `/changelog` route
- Uses same format as blog posts
- Configured with 5 recent releases in sidebar

### Code (code/)

README docs from apps and packages are copied into `code/` at build time so the **Code** tab can show them without manual duplication.

- **Script**: `scripts/copy-code-readmes.mjs` — copies README.md from monorepo apps/packages into `code/apps/` and `code/packages/`.
- **When**: Run automatically before `pnpm start` and `pnpm build`; or run `pnpm docs:prepare` to refresh only.
- **Source of truth**: READMEs stay in each app/package; generated files under `code/apps/*.md` and `code/packages/*.md` are gitignored.
- **Sidebar**: `sidebars-code.ts`. To add a new README, add its path to `COPY_LIST` in the script and the doc id to the sidebar.

## Deployment

### AWS Amplify

The site is deployed using AWS Amplify:

- **amplify.yml** - Build configuration
- **amplify-prebuild.sh** - Pre-build setup (Node.js version, etc.)
- **amplify-build.sh** - Build execution script

AWS Amplify automatically builds and deploys the site when changes are pushed to the repository.

## Configuration

### Main Config (docusaurus.config.ts)

Key settings:

- **Title**: "SLAOps"
- **Tagline**: "SLAOps the Devops Engineer"
- **URL**: https://blog.SLAOps.com
- **Edit URLs**: Point to GitHub repository
- **Broken links**: Set to throw errors (strict mode)

### Theme

- Prism syntax highlighting (GitHub light, Dracula dark)
- Custom CSS in `src/css/custom.css`
- KaTeX stylesheet for math rendering
- Social card: `img/docusaurus-social-card.jpg`

## Monorepo Context

This documentation site is part of the SLAOps monorepo and has dependencies on shared packages:

- `@slaops/private` - Core utilities and types
- `@slaops/public` - Shared library functions

**Important**: When working in the monorepo:

- Always use `pnpm` for package management
- Build shared dependencies before building slaops-docs
- Install dependencies from the monorepo root
- Use pnpm workspace filters for targeted operations

## Keeping Documentation Updated

When making changes to the SLAOps platform:

1. **Update relevant documentation** in `docs/` directory
2. **Add changelog entries** in `changelog/` for releases
3. **Create blog posts** in `blog/` for major features or updates
4. **Update examples** to reflect API/SDK changes
5. **Regenerate heading IDs** if adding new sections: `pnpm run write-heading-ids`
6. **Test locally** before committing: `pnpm start`
7. **Build verification**: `pnpm run build` to catch broken links

## License

Dual-licensed under ISC OR GPL-3.0

## Author

SLAOps@SLAOps.com

## Links

- **Live Site**: https://blog.SLAOps.com
- **GitHub**: https://github.com/derrickfutschik/slaops-platform
- **Stack Overflow**: https://stackoverflow.com/users/4033292/SLAOps
