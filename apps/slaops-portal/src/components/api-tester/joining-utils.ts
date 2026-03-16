// ---------------------------------------------------------------------------
// Joining column utilities for MaximizableCodeViewer table view
// ---------------------------------------------------------------------------

export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false

    if (Array.isArray(a)) {
      if (a.length !== b.length) return false
      return a.every((item, idx) => deepEqual(item, b[idx]))
    } else {
      const aKeys = Object.keys(a).sort()
      const bKeys = Object.keys(b).sort()
      if (aKeys.length !== bKeys.length) return false
      if (!aKeys.every((key, idx) => key === bKeys[idx])) return false
      return aKeys.every((key) => deepEqual(a[key], b[key]))
    }
  }

  return false
}

export interface JoiningContext {
  /** Display names for each joining column (one per array traversal, except the last). */
  joiningColumns: string[]
  /** Per result-row values: rowIndices[i][j] is the string value for row i, joining column j. */
  rowIndices: string[][]
}

// ---------------------------------------------------------------------------
// JMESPath path segment parser
// ---------------------------------------------------------------------------

interface PathSegment {
  /** Property names to navigate from the current element before the array op. */
  properties: string[]
  /** Display label for this joining column (the last property name, or '#N' if anonymous). */
  label: string
}

/**
 * Parses a JMESPath expression into an ordered list of "array traversal segments".
 * Each segment describes the property navigation to reach the next array, plus a
 * label for the joining column.
 *
 * Supports the common pattern: `field[*].a.b[].c[]`
 * Returns null for any expression with unsupported syntax (functions, multi-select, etc.)
 */
function parseArraySegments(query: string): PathSegment[] | null {
  const segments: PathSegment[] = []
  const str = query.trim()
  let i = 0
  let currentProps: string[] = []

  while (i < str.length) {
    if (str[i] === '.') { i++; continue }

    // Property name
    const propMatch = str.slice(i).match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/)
    if (propMatch) {
      currentProps.push(propMatch[1])
      i += propMatch[1].length
      continue
    }

    // [*] or []
    if (str[i] === '[') {
      const close = str.indexOf(']', i)
      if (close === -1) return null
      const inner = str.slice(i + 1, close)
      if (inner === '*' || inner === '') {
        const label = currentProps.length > 0
          ? currentProps[currentProps.length - 1]
          : `#${segments.length}`
        segments.push({ properties: currentProps, label })
        currentProps = []
        i = close + 1
        continue
      }
      // [0], [1:2], etc. — not supported
      return null
    }

    // Any other character (|, ?, {, etc.) — bail out
    return null
  }

  return segments.length > 0 ? segments : null
}

// ---------------------------------------------------------------------------
// Index-tracking evaluator
// ---------------------------------------------------------------------------

function navigateProperties(data: any, props: string[]): any {
  let current = data
  for (const p of props) {
    if (current === null || current === undefined) return undefined
    current = current[p]
  }
  return current
}

/**
 * Walks the original data following the parsed path segments, recording the
 * array index at each non-final traversal level.
 *
 * For `hits[*].document.operationStats[][].pathPrefixes[]`:
 *   segments = [hits, operationStats, #2, pathPrefixes]
 *   joining  = [hits, operationStats, #2]       (all except last)
 *   final    = pathPrefixes                     (produces result rows)
 *
 * Returns one index-tuple per result row, or null if the count doesn't match.
 */
function computeRowIndices(
  data: any,
  segments: PathSegment[],
  resultCount: number,
): string[][] | null {
  const result: string[][] = []
  const joiningCount = segments.length - 1  // last segment is the result array

  function walk(node: any, segIndex: number, currentIndices: string[]): void {
    const arr = navigateProperties(node, segments[segIndex].properties)
    if (!Array.isArray(arr)) return

    const isLast = segIndex === segments.length - 1

    arr.forEach((item, idx) => {
      if (isLast) {
        // Each item in the final array is one result row
        result.push(currentIndices)
      } else {
        walk(item, segIndex + 1, [...currentIndices, String(idx)])
      }
    })
  }

  walk(data, 0, [])

  if (result.length !== resultCount) return null
  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Given the original JSON and a JMESPath query that produces a flat array,
 * computes joining columns derived from the array traversal positions in the path.
 *
 * For `hits[*].document.operationStats[][].pathPrefixes[]`:
 *   → joiningColumns = ["hits", "operationStats", "#2"]
 *   → rowIndices[i]  = [hitsIdx, operationStatsIdx, innerIdx] for result row i
 *
 * Returns null if the query can't be parsed or the structure doesn't match.
 */
export function detectJoiningContext(
  original: any,
  query: string,
  resultCount: number,
): JoiningContext | null {
  const segments = parseArraySegments(query)
  // Need at least 2 array ops: one for the result and at least one joining level
  if (!segments || segments.length < 2) return null

  const rowIndices = computeRowIndices(original, segments, resultCount)
  if (!rowIndices) return null

  const joiningColumns = segments.slice(0, -1).map((s) => s.label)
  return { joiningColumns, rowIndices }
}
