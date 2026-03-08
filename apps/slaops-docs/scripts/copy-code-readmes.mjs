/**
 * Copies README.md files from monorepo apps and packages into the docs app's
 * code/ directory so the "Code" tab can surface them without manual duplication.
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
const codeDir = path.join(docsDir, 'code')

/** [source path relative to monorepo root, dest path relative to code/] */
const COPY_LIST = [
  ['apps/slaops-cloud/README.md', 'apps/slaops-cloud.md'],
  ['apps/slaops-cloud/src/openapi-indexer/README.md', 'apps/slaops-cloud/openapi-indexer.md'],
  ['apps/slaops-cloud/src/openapi-search/README.md', 'apps/slaops-cloud/openapi-search.md'],
  ['apps/slaops-portal/README.md', 'apps/slaops-portal.md'],
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
  // Fix relative links that break in Docusaurus when viewed under /code/
  if (destRel === 'apps/slaops-cloud.md') {
    content = content.replace(
      /\]\(\.\.\/\.\.\/packages\/slaops-backend\/README\.md\)/g,
      '](/code/packages/slaops-backend)'
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
      console.log(`Copied: ${srcRel} → code/${destRel}`)
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
        console.log(`Copied: ${srcRel} → code/${destRel}`)
      }
    })
  }
}
