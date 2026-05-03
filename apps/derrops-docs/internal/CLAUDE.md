# Internal Content

All content here requires Cognito auth enforced at the Amplify Hosting layer on the `/internal/*` URL prefix — no Docusaurus-level auth is needed.

## `platform/design/` — Architecture decision records

Completed design docs and ADRs. Sidebar auto-generated. See `design/CLAUDE.md` for tagging conventions, document types, and cross-linking rules.

## `platform/drafts/` — WIP ideas and research notes

Anything not yet ready to be a formal design doc goes here. Never put drafts in the public tree.

## `developer/code/` — Monorepo READMEs (auto-copied)

**Do not edit files here directly** — edit the source `README.md` in the relevant app or package.

- **Script**: `scripts/copy-code-readmes.mjs`
- **When**: Runs automatically before `pnpm start` and `pnpm build`; or `pnpm docs:prepare` to refresh manually.
- **Adding a new README**: Add its path to `COPY_LIST` in the script and add the doc id to `sidebars-developer.ts`.

## `devops/` — Sprint planning and user stories

Sidebar manually defined in `sidebars-devops.ts`.

## `security/` — Full security knowledge base

Threat models, pen-test results, compliance evidence, incident runbooks. Keep customer-facing summaries in `public/security/` instead.

## `testing/` — Test reports and quality metrics

Add subdirectories `unit/`, `integration/`, `e2e/` as needed.
