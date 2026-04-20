/**
 * Copies README.md files from monorepo apps and packages into the docs app's
 * internal/developer/code/ directory so the "Developer" tab can surface them
 * without manual duplication.
 *
 * Run from apps/slaops-docs (e.g. pnpm docs:prepare). Monorepo root is two levels up from docs dir.
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
  ['apps/slaops-cloud/README.md', 'apps/slaops-cloud.md'],
  ['apps/slaops-cloud/src/openapi-indexer/README.md', 'apps/slaops-cloud/openapi-indexer.md'],
  ['apps/slaops-cloud/src/openapi-search/README.md', 'apps/slaops-cloud/openapi-search.md'],
  ['apps/slaops-portal/README.md', 'apps/slaops-portal.md'],
  ['apps/slaops-relay/README.md', 'apps/slaops-relay.md'],
  ['apps/slaops-aegis/README.md', 'apps/slaops-aegis.md'],
  ['packages/slaops-config/README.md', 'packages/slaops-config.md'],
  ['packages/slaops-private/README.md', 'packages/slaops-private.md'],
  ['packages/slaops-public/README.md', 'packages/slaops-public.md'],
  ['packages/slaops-backend/README.md', 'packages/slaops-backend.md'],
  ['packages/slaops-infra/README.md', 'packages/slaops-infra.md'],
  ['packages/slaops-client-nodejs-axios/README.md', 'packages/slaops-client-nodejs-axios.md'],
  ['packages/slaops-test/README.md', 'packages/slaops-test.md'],
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
  if (destRel === 'apps/slaops-cloud.md') {
    content = content.replace(
      /\]\(\.\.\/\.\.\/packages\/slaops-backend\/README\.md\)/g,
      '](/internal/developer/packages/slaops-backend)',
    )
    content = content.replace(
      /\]\(\.\.\/\.\.\/packages\/slaops-infra\/README\.md\)/g,
      '](/internal/developer/packages/slaops-infra)',
    )
    content = content.replace(
      /\]\(\.\.\/slaops-docs\/notes\/proposals\/cloud-relay\/component-cloud-relay\.md\)/g,
      '](/internal/platform/design/cloud-relay/component-cloud-relay)',
    )
  }
  if (destRel === 'apps/slaops-aegis.md') {
    content = content.replace(
      /\]\(\/notes\/proposals\/cloud-relay\/component-cloud-relay\.md\)/g,
      '](/internal/platform/design/cloud-relay/component-cloud-relay)',
    )
    content = content.replace(
      /\]\(\.\.\/slaops-docs\/notes\/proposals\/cloud-relay\/aegis-token-broker-design\.md\)/g,
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
