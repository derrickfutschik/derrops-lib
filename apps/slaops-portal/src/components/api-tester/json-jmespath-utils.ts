import jmespath from 'jmespath'
import { deepEqual } from './joining-utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type JsonStats =
  | { type: 'array'; count: number; totalKeys: number }
  | { type: 'object'; keys: number; totalKeys: number; depth: number }
  | null

export interface JmespathQueryResult {
  filteredContent: string | null
  matchedPaths: Set<string>
  jmespathError: string | null
  jmespathNullResult: boolean
}

export const EMPTY_JMESPATH_RESULT: JmespathQueryResult = {
  filteredContent: null,
  matchedPaths: new Set<string>(),
  jmespathError: null,
  jmespathNullResult: false,
}

// ── JMESPath evaluation ───────────────────────────────────────────────────────

/**
 * Find JSON paths in `original` that correspond to the JMESPath `result`.
 * Returns a Set of path strings (e.g. "hits[0].document.name") to highlight.
 *
 * Fast-path: simple field-access queries (no wildcards or functions) are
 * resolved directly without a full structural traversal.
 */
export function findJmespathJsonLocations(original: any, result: any, query: string): Set<string> {
  const matchedPaths = new Set<string>()

  const addPathAndChildren = (obj: any, currentPath: string): void => {
    matchedPaths.add(currentPath)
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
          addPathAndChildren(item, currentPath ? `${currentPath}[${idx}]` : `[${idx}]`)
        })
      } else {
        Object.keys(obj).forEach((key) => {
          addPathAndChildren(obj[key], currentPath ? `${currentPath}.${key}` : key)
        })
      }
    }
  }

  const simplePathRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[\d+\])*$/
  if (simplePathRegex.test(query.trim())) {
    const path = query.trim()
    const pathParts = path.match(/[a-zA-Z_$][a-zA-Z0-9_$]*|\[\d+\]/g) || []
    let current = original
    let valid = true

    for (const part of pathParts) {
      if (part.startsWith('[')) {
        const index = parseInt(part.slice(1, -1), 10)
        if (Array.isArray(current) && index >= 0 && index < current.length) {
          current = current[index]
        } else {
          valid = false
          break
        }
      } else {
        if (current && typeof current === 'object' && part in current) {
          current = current[part]
        } else {
          valid = false
          break
        }
      }
    }

    if (valid && deepEqual(current, result)) {
      addPathAndChildren(current, path)
      return matchedPaths
    }
  }

  // Slow-path: structural containment matching
  const isInResult = (value: any, res: any, checkPartial = true): boolean => {
    if (deepEqual(value, res)) return true
    if (!checkPartial) return false
    if (Array.isArray(res)) return res.some((item) => isInResult(value, item, true))
    if (res && typeof res === 'object' && !Array.isArray(res)) {
      return Object.values(res).some((v) => isInResult(value, v, true))
    }
    return false
  }

  const traverse = (obj: any, currentPath: string): void => {
    if (isInResult(obj, result, true)) matchedPaths.add(currentPath)
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => traverse(item, currentPath ? `${currentPath}[${idx}]` : `[${idx}]`))
      } else {
        Object.keys(obj).forEach((key) => traverse(obj[key], currentPath ? `${currentPath}.${key}` : key))
      }
    }
  }

  traverse(original, '')
  return matchedPaths
}

/**
 * Run a JMESPath query against a pre-parsed JSON object and return the
 * filter/highlight result. Throws nothing — errors are returned as `jmespathError`.
 */
export function evaluateJmespathQuery(
  parsedContent: any,
  query: string,
  mode: 'filter' | 'highlight',
): JmespathQueryResult {
  try {
    const result = jmespath.search(parsedContent, query)
    const isNull = result === null
    if (mode === 'filter') {
      return {
        filteredContent: JSON.stringify(result, null, 2),
        matchedPaths: new Set<string>(),
        jmespathError: null,
        jmespathNullResult: isNull,
      }
    }
    return {
      filteredContent: null,
      matchedPaths: findJmespathJsonLocations(parsedContent, result, query),
      jmespathError: null,
      jmespathNullResult: isNull,
    }
  } catch (e: unknown) {
    return {
      filteredContent: null,
      matchedPaths: new Set<string>(),
      jmespathError: e instanceof Error ? e.message : 'Invalid JMESPath query',
      jmespathNullResult: false,
    }
  }
}

/**
 * Build the new JMESPath expression when the user clicks a node in the
 * filtered JSON viewer (filter mode). Appends to the existing query using
 * array wildcard projection when the filtered result is an array.
 */
export function buildFilteredJmespathExpression(
  currentQuery: string,
  filteredContent: string | null,
  clickedPath: string,
): string {
  if (!currentQuery.trim() || filteredContent === null) return clickedPath
  try {
    const parsed = JSON.parse(filteredContent)
    if (Array.isArray(parsed)) {
      if (/^\[\d+\]$/.test(clickedPath)) return `${currentQuery} | ${clickedPath}`
      const stripped = clickedPath.replace(/^\[\d+\]\.?/, '')
      const suffix = stripped
        ? stripped.startsWith('[') ? `[]${stripped}` : `[].${stripped}`
        : '[]'
      return `${currentQuery}${suffix}`
    }
    const separator = clickedPath.startsWith('[') ? '' : '.'
    return `${currentQuery}${separator}${clickedPath}`
  } catch {
    return clickedPath
  }
}

// ── JSON array utilities ──────────────────────────────────────────────────────

/**
 * Parse a JSON string and return a deduplicated array as a formatted JSON
 * string, or null if the content is not a JSON array.
 */
export function deduplicateJsonArray(content: string): string | null {
  try {
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) return null
    const seen = new Set<string>()
    const unique = parsed.filter((item) => {
      const key = JSON.stringify(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return JSON.stringify(unique, null, 2)
  } catch {
    return null
  }
}

/**
 * Count the number of duplicate items in a JSON array.
 * Returns 0 for non-array content or parse errors.
 */
export function countDuplicates(content: string): number {
  try {
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) return 0
    const seen = new Set<string>()
    let dupes = 0
    for (const item of parsed) {
      const key = JSON.stringify(item)
      if (seen.has(key)) dupes++
      else seen.add(key)
    }
    return dupes
  } catch {
    return 0
  }
}

// ── Stats & metrics ───────────────────────────────────────────────────────────

/**
 * Compute structural stats (item count, key count, depth) for a JSON string.
 * Returns null for non-object/array JSON or parse errors.
 */
export function computeJsonStats(content: string): JsonStats {
  try {
    const parsed = JSON.parse(content)
    const getMaxDepth = (val: any): number => {
      if (typeof val !== 'object' || val === null) return 0
      const children = Array.isArray(val) ? val : Object.values(val)
      if (children.length === 0) return 1
      return 1 + Math.max(...children.map(getMaxDepth))
    }
    const countTotalKeys = (val: any): number => {
      if (typeof val !== 'object' || val === null) return 0
      if (Array.isArray(val)) return val.reduce((sum: number, item) => sum + countTotalKeys(item), 0)
      const keys = Object.keys(val)
      return keys.length + keys.reduce((sum: number, key) => sum + countTotalKeys(val[key]), 0)
    }
    if (Array.isArray(parsed)) {
      return { type: 'array', count: parsed.length, totalKeys: countTotalKeys(parsed) }
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        type: 'object',
        keys: Object.keys(parsed).length,
        totalKeys: countTotalKeys(parsed),
        depth: getMaxDepth(parsed),
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Compute the percentage of the original content represented by the filtered
 * content (by compacted byte length). Returns null when filtering is not active.
 */
export function computeFilterPercent(content: string, filteredContent: string): number | null {
  try {
    const originalCompact = JSON.stringify(JSON.parse(content))
    const filteredCompact = JSON.stringify(JSON.parse(filteredContent))
    if (originalCompact.length === 0) return null
    return Math.round((filteredCompact.length / originalCompact.length) * 1000) / 10
  } catch {
    return null
  }
}
