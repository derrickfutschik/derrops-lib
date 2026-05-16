#!/usr/bin/env node
/**
 * Generates shared TypeScript path mappings so ⌘+click resolves workspace packages
 * to source (`src/` / `lib/`) instead of `dist/*.d.ts` (tsup does not emit declaration maps).
 *
 * Run after adding a workspace package or `@derrops/*` app:
 *   pnpm sync:ts-paths
 *
 * Writes:
 *   - tsconfig.workspace-paths.json  — paths only (for configs that cannot extend tsconfig.base.json)
 *   - tsconfig.library.json          — tsconfig.base.json + same paths (default for packages/apps)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(relPath, obj) {
  const target = path.join(root, relPath)
  fs.writeFileSync(target, `${JSON.stringify(obj, null, 2)}\n`, 'utf8')
}

function listDirs(absDir) {
  if (!fs.existsSync(absDir)) return []
  return fs
    .readdirSync(absDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

function safePkg(relDir) {
  const pkgPath = path.join(root, relDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  try {
    const pkg = readJson(pkgPath)
    if (!pkg.name) return null
    return { name: pkg.name, relDir }
  } catch {
    return null
  }
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function pathsForPackageDir(folderBasename, relDir) {
  if (folderBasename === 'derrops-backend') {
    return { starOnly: [`${relDir}/amplify/*`] }
  }
  if (folderBasename === 'derrops-infra') {
    return { starOnly: [`${relDir}/lib/*`] }
  }
  if (folderBasename === 'test-resources') {
    if (exists(`${relDir}/loader.ts`)) {
      return {
        main: [`${relDir}/loader.ts`],
        starOnly: [`${relDir}/*`],
      }
    }
    return null
  }
  if (exists(`${relDir}/src/index.ts`)) {
    return {
      main: [`${relDir}/src/index.ts`],
      starOnly: [`${relDir}/src/*`],
    }
  }
  return null
}

function buildPaths() {
  /** @type {Record<string, string[]>} */
  const paths = {}

  paths['@/*'] = ['apps/derrops-portal/src/*']

  const packageDirs = listDirs(path.join(root, 'packages')).map((d) => `packages/${d}`)
  /** Workspace roots outside `packages/*` (see pnpm-workspace.yaml). */
  const extraPackageRoots = ['test-resources']
  const allPackageDirs = [...packageDirs, ...extraPackageRoots.filter((p) => exists(p))]
  for (const relDir of allPackageDirs) {
    const meta = safePkg(relDir)
    if (!meta) continue
    const folder = path.basename(relDir)
    const ep = pathsForPackageDir(folder, relDir)
    if (!ep) continue
    const { name } = meta
    if (ep.main) paths[name] = ep.main
    if (ep.starOnly) paths[`${name}/*`] = ep.starOnly
  }

  const appDirs = listDirs(path.join(root, 'apps')).map((d) => `apps/${d}`)
  for (const relDir of appDirs) {
    const meta = safePkg(relDir)
    if (!meta || !meta.name.startsWith('@derrops/')) continue
    const { name } = meta
    if (!exists(`${relDir}/src`)) continue
    if (exists(`${relDir}/src/index.ts`)) {
      paths[name] = [`${relDir}/src/index.ts`]
    } else if (exists(`${relDir}/src/main.ts`)) {
      paths[name] = [`${relDir}/src/main.ts`]
    }
    paths[`${name}/*`] = [`${relDir}/src/*`]
  }

  const sorted = {}
  for (const key of Object.keys(paths).sort()) {
    sorted[key] = paths[key]
  }
  return sorted
}

function main() {
  const paths = buildPaths()

  writeJson('tsconfig.workspace-paths.json', {
    $schema: 'https://json.schemastore.org/tsconfig',
    compilerOptions: {
      baseUrl: '.',
      paths,
    },
  })

  writeJson('tsconfig.library.json', {
    $schema: 'https://json.schemastore.org/tsconfig',
    extends: './tsconfig.base.json',
    compilerOptions: {
      baseUrl: '.',
      paths,
    },
  })

  console.log(
    `Wrote tsconfig.workspace-paths.json + tsconfig.library.json (${Object.keys(paths).length} path entries).`,
  )
}

main()
