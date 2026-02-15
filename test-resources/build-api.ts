import { readdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const apisDir = join(__dirname, 'openapi-directory', 'APIs')

async function buildLookup() {
  const lookup = {}
  const providers = await readdir(apisDir, { withFileTypes: true })

  for (const provider of providers) {
    if (!provider.isDirectory()) continue

    const providerPath = join(apisDir, provider.name)
    const apis = await readdir(providerPath, { withFileTypes: true })

    for (const api of apis) {
      if (!api.isDirectory()) continue

      const apiPath = join(providerPath, api.name)
      const versions = await readdir(apiPath, { withFileTypes: true })
      const versionDirs = versions.filter((v) => v.isDirectory())

      if (versionDirs.length === 0) continue

      lookup[provider.name] ??= {}
      lookup[provider.name][api.name] = {}
      for (const v of versionDirs) {
        const versionPath = join(apiPath, v.name)
        const files = await readdir(versionPath)
        const specFile = files.find(
          (f) => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json'),
        )
        if (!specFile) continue
        lookup[provider.name][api.name][v.name] =
          `${provider.name}/${api.name}/${v.name}/${specFile}`
      }
    }
  }

  const outPath = join(__dirname, 'apis.ts')
  await writeFile(outPath, `export default ${JSON.stringify(lookup, null, 2)} as const\n`)
  console.log(`Written to ${outPath}`)
  console.log(`Providers: ${Object.keys(lookup).length}`)
  console.log(
    `Total APIs: ${Object.values(lookup).reduce((sum, apis) => sum + Object.keys(apis).length, 0)}`,
  )
}

buildLookup()
