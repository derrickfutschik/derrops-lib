/**
 * Copies README.md files from monorepo apps and packages into the docs app's
 * internal/developer/code/ directory so the "Developer" tab can surface them
 * without manual duplication.
 *
 * Run from apps/derrops-docs (e.g. pnpm docs:prepare). Monorepo root is two levels up from docs dir.
 * Pass --watch to do the initial copy then re-copy on source file changes.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const docsDir = path.resolve(__dirname, '..')
const root = path.resolve(docsDir, '..', '..')
const codeDir = path.join(docsDir, 'internal', 'developer', 'code')

/** [source path relative to monorepo root, dest path relative to internal/developer/code/] */
const COPY_LIST = [
  ['apps/derrops-cloud/README.md', 'apps/derrops-cloud.md'],
  ['apps/derrops-cloud/src/openapi-indexer/README.md', 'apps/derrops-cloud/openapi-indexer.md'],
  ['apps/derrops-cloud/src/openapi-search/README.md', 'apps/derrops-cloud/openapi-search.md'],
  ['apps/derrops-portal/README.md', 'apps/derrops-portal.md'],
  ['apps/derrops-relay/README.md', 'apps/derrops-relay.md'],
  ['apps/derrops-aegis/README.md', 'apps/derrops-aegis.md'],
  ['packages/derrops-config/README.md', 'packages/derrops-config.md'],
  ['packages/derrops-private/README.md', 'packages/derrops-private.md'],
  ['packages/derrops-public/README.md', 'packages/derrops-public.md'],
  ['packages/derrops-backend/README.md', 'packages/derrops-backend.md'],
  ['packages/derrops-infra/README.md', 'packages/derrops-infra.md'],
  ['packages/derrops-client-nodejs-axios/README.md', 'packages/derrops-client-nodejs-axios.md'],
  ['packages/derrops-test/README.md', 'packages/derrops-test.md'],
]

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function copyFile(srcRel, destRel) {
  const src = path.join(root, srcRel)
  const dest = path.join(codeDir, destRel)
  if (!fs.existsSync(src)) {
    console.warn(`Skip (missing): ${srcRel}`)
    return false
  }
  ensureDir(path.dirname(dest))
  let content = fs.readFileSync(src, 'utf8')
  // Fix relative links that break in Docusaurus when viewed under /internal/developer/
  if (destRel === 'apps/derrops-cloud.md') {
    content = content.replace(
      /\]\(\.\.\/\.\.\/packages\/derrops-backend\/README\.md\)/g,
      '](/internal/developer/packages/derrops-backend)',
    )
    content = content.replace(
      /\]\(\.\.\/\.\.\/packages\/derrops-infra\/README\.md\)/g,
      '](/internal/developer/packages/derrops-infra)',
    )
    content = content.replace(
      /\]\(\.\.\/derrops-docs\/notes\/proposals\/cloud-relay\/component-cloud-relay\.md\)/g,
      '](/internal/platform/design/cloud-relay/component-cloud-relay)',
    )
  }
  if (destRel === 'apps/derrops-aegis.md') {
    content = content.replace(
      /\]\(\/notes\/proposals\/cloud-relay\/component-cloud-relay\.md\)/g,
      '](/internal/platform/design/cloud-relay/component-cloud-relay)',
    )
    content = content.replace(
      /\]\(\.\.\/derrops-docs\/notes\/proposals\/cloud-relay\/aegis-token-broker-design\.md\)/g,
      '](/internal/platform/design/cloud-relay/aegis-token-broker-design)',
    )
  }
  fs.writeFileSync(dest, content)
  return true
}

function copyAll() {
  let copied = 0
  let skipped = 0
  for (const [srcRel, destRel] of COPY_LIST) {
    if (copyFile(srcRel, destRel)) {
      console.log(`Copied: ${srcRel} → internal/developer/code/${destRel}`)
      copied++
    } else {
      skipped++
    }
  }
  console.log(`\nCode READMEs: ${copied} copied, ${skipped} skipped.`)
}

copyAll()

if (process.argv.includes('--watch')) {
  console.log('\nWatching source READMEs for changes...')
  for (const [srcRel, destRel] of COPY_LIST) {
    const src = path.join(root, srcRel)
    if (!fs.existsSync(src)) continue
    fs.watch(src, () => {
      console.log(`Changed: ${srcRel} — re-copying...`)
      if (copyFile(srcRel, destRel)) {
        console.log(`Copied: ${srcRel} → internal/developer/code/${destRel}`)
      }
    })
  }
}
