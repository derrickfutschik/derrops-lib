/**
 * Utilities for JMESPath autocomplete:
 * 1. Extract all wildcard-only paths from a JSON value
 * 2. Fuzzy search those paths (case-insensitive, space-separated terms)
 */

// ---------------------------------------------------------------------------
// Path extraction
// ---------------------------------------------------------------------------

/**
 * Recursively walks a parsed JSON value and collects every unique
 * dot-separated path, using `[*]` for array traversal (never `[0]`).
 *
 * Example output for `{ hits: [{ document: { name: "x" } }] }`:
 *   ["hits[*]", "hits[*].document", "hits[*].document.name"]
 */
function removeBareArrayPaths(paths: string[]): string[] {
  const pathSet = new Set(paths)
  return paths.filter((path) => !pathSet.has(`${path}[*]`))
}

export function extractWildcardPaths(data: unknown): string[] {
  const paths = new Set<string>()

  function walk(value: unknown, prefix: string) {
    if (value === null || value === undefined) return

    if (Array.isArray(value)) {
      const arrayPath = prefix ? `${prefix}[*]` : '[*]'
      paths.add(arrayPath)

      // Sample the first element for structure (all elements assumed homogeneous)
      if (value.length > 0) {
        walk(value[0], arrayPath)
      }
      return
    }

    if (typeof value === 'object') {
      if (prefix) paths.add(prefix)
      const keys = Object.keys(value as Record<string, unknown>)
      for (const key of keys) {
        const child = (value as Record<string, unknown>)[key]
        const childPath = prefix ? `${prefix}.${key}` : key
        walk(child, childPath)
      }
      return
    }

    // Leaf (string, number, boolean)
    if (prefix) paths.add(prefix)
  }

  walk(data, '')
  return removeBareArrayPaths(Array.from(paths)).sort()
}

// ---------------------------------------------------------------------------
// Fuzzy search
// ---------------------------------------------------------------------------

/**
 * Case-insensitive fuzzy match supporting space-separated terms.
 * Each term must appear somewhere in the path (in any order).
 * Also supports camelCase boundary matching — a term like "path"
 * will match "pathPrefixes" or "somePath".
 *
 * Returns paths sorted by relevance (shorter paths first, then alphabetical).
 */
export function fuzzySearchPaths(
  paths: string[],
  query: string,
): string[] {
  const deduped = removeBareArrayPaths(paths)

  const raw = query.trim()
  if (!raw) return deduped

  const terms = raw.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return deduped

  const matches = deduped.filter((p) => {
    const lower = p.toLowerCase()
    return terms.every((term) => lower.includes(term))
  })

  // Sort: shorter paths first (more specific / closer match), then alphabetical
  matches.sort((a, b) => a.length - b.length || a.localeCompare(b))
  return matches
}
