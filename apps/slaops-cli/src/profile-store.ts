import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export const SLAOPS_DIR = path.join(os.homedir(), '.slaops')
export const DEFAULT_PROFILE = 'default'

/**
 * A flat map of key→value pairs for a single profile section.
 */
export type ProfileSection = Record<string, string>

/**
 * All profiles in a file, keyed by profile name.
 */
export type ProfileStore = Record<string, ProfileSection>

// ---------------------------------------------------------------------------
// Minimal TOML-compatible parser / writer (sections + key = "value" only).
// Covers the full requirements of the config and credentials files without
// external dependencies.
// ---------------------------------------------------------------------------

export function parse(content: string): ProfileStore {
  const result: ProfileStore = {}
  let section = DEFAULT_PROFILE

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line)
    if (sectionMatch) {
      section = sectionMatch[1]
      result[section] ??= {}
      continue
    }

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue

    const key = line.slice(0, eqIdx).trim()
    let value = line.slice(eqIdx + 1).trim()

    // Strip surrounding quotes (single or double)
    if (
      value.length >= 2 &&
      value[0] === value[value.length - 1] &&
      (value[0] === '"' || value[0] === "'")
    ) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }

    result[section] ??= {}
    result[section][key] = value
  }

  return result
}

export function stringify(store: ProfileStore): string {
  const lines: string[] = []

  for (const [profile, values] of Object.entries(store)) {
    if (lines.length > 0) lines.push('')
    lines.push(`[${profile}]`)
    for (const [key, value] of Object.entries(values)) {
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      lines.push(`${key} = "${escaped}"`)
    }
  }

  return lines.join('\n') + '\n'
}

export function readProfileStore(filePath: string): ProfileStore {
  if (!fs.existsSync(filePath)) return {}
  return parse(fs.readFileSync(filePath, 'utf8'))
}

export function writeProfileStore(filePath: string, store: ProfileStore, mode = 0o644): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, stringify(store), { mode })
}

export function getSection(
  filePath: string,
  profile = DEFAULT_PROFILE,
): ProfileSection | undefined {
  return readProfileStore(filePath)[profile]
}

export function setSection(
  filePath: string,
  values: ProfileSection,
  profile = DEFAULT_PROFILE,
  mode = 0o644,
): void {
  const store = readProfileStore(filePath)
  store[profile] = { ...(store[profile] ?? {}), ...values }
  writeProfileStore(filePath, store, mode)
}
