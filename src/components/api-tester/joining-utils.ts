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
 * For `hits[*].document.sampleOperations[*].path[]`:
 *   segments = [hits, sampleOperations, path]
 *   joining  = [hits, sampleOperations]   (all except last)
 *   final    = path                        (scalar — produces 1 row per parent element)
 *
 * The last segment may produce either an array (one row per item) or a scalar
 * (one row for the entire parent element). Both cases are handled.
 *
 * Returns one index-tuple per result row, or null if the count doesn't match.
 */
function computeRowIndices(
  data: any,
  segments: PathSegment[],
  resultCount: number,
): string[][] | null {
  const result: string[][] = []

  function walk(node: any, segIndex: number, currentIndices: string[]): void {
    const value = navigateProperties(node, segments[segIndex].properties)
    const isLast = segIndex === segments.length - 1

    if (isLast) {
      if (Array.isArray(value)) {
        // Final segment is an array: each element produces one result row
        value.forEach(() => result.push(currentIndices))
      } else if (value !== null && value !== undefined) {
        // Final segment is a scalar (e.g. `path` in `sampleOperations[*].path[]`):
        // the [] flatten operator in JMESPath is applied at the outer level, so
        // each parent element contributes exactly one result row.
        result.push(currentIndices)
      }
      return
    }

    if (!Array.isArray(value)) return
    value.forEach((item, idx) => {
      walk(item, segIndex + 1, [...currentIndices, String(idx)])
    })
  }

  walk(data, 0, [])

  if (result.length !== resultCount) return null
  return result
}

// ---------------------------------------------------------------------------
// Join column candidates
// ---------------------------------------------------------------------------

/**
 * A candidate attribute that can be used as a join column instead of the default index.
 * Only attributes whose values are unique within their parent group are included.
 */
export interface JoinColumnCandidate {
  /** Display label shown in the combobox (e.g. "hits[*].document.id"). */
  label: string
  /** Unique key; '__default__' for the index-based default. */
  path: string
  /** True for the index-based default option. */
  isDefault: boolean
  /**
   * Per-result-row values: values[i] is the string value for result row i.
   * Length equals the number of result rows.
   */
  values: string[]
}

/**
 * Discovers candidate join columns for all joining segments of a JMESPath query.
 *
 * For `hits[*].document.sampleOperations[*].path[]` returns two arrays:
 *   [0]: candidates for hits[*]      (e.g. hits[*].id, hits[*].document.title)
 *   [1]: candidates for sampleOperations[*] (e.g. hits[*].document.sampleOperations[*].path)
 *
 * Uniqueness is checked within each parent group:
 *   - For joining level 0: values must be unique across all elements of that array.
 *   - For joining level j>0: values must be unique within each group sharing the
 *     same parent indices (0..j-1).
 *
 * The default index-based candidate is always the first entry in each array.
 */
export function detectJoinColumnCandidates(
  original: any,
  query: string,
  joiningContext: JoiningContext,
): JoinColumnCandidate[][] {
  const segments = parseArraySegments(query)
  if (!segments || segments.length < 2) return []

  const joiningCount = segments.length - 1
  const resultCount = joiningContext.rowIndices.length

  return Array.from({ length: joiningCount }, (_, j) =>
    computeSegmentCandidates(original, segments, j, joiningContext, resultCount),
  )
}

function computeSegmentCandidates(
  original: any,
  segments: PathSegment[],
  j: number,
  joiningContext: JoiningContext,
  resultCount: number,
): JoinColumnCandidate[] {
  const candidates: JoinColumnCandidate[] = []

  // Build full path prefix up to (and including) segment j.
  // e.g. j=0 → 'hits[*]'; j=1 → 'hits[*].document.sampleOperations[*]'
  let basePathPrefix = ''
  for (let k = 0; k <= j; k++) {
    if (k > 0) basePathPrefix += '.'
    basePathPrefix += segments[k].properties.join('.') + '[*]'
  }

  // Navigate to the joining element at level j for each result row.
  const elementForRow: any[] = new Array(resultCount)
  for (let i = 0; i < resultCount; i++) {
    const rowIndices = joiningContext.rowIndices[i]
    let node: any = original
    let valid = true
    for (let k = 0; k <= j; k++) {
      const arr = navigateProperties(node, segments[k].properties)
      if (!Array.isArray(arr)) { valid = false; break }
      const idx = parseInt(rowIndices[k], 10)
      if (isNaN(idx) || idx < 0 || idx >= arr.length) { valid = false; break }
      node = arr[idx]
    }
    elementForRow[i] = valid ? node : undefined
  }

  // Default candidate: positional index at level j.
  candidates.push({
    label: `${segments[j].label} (index)`,
    path: '__default__',
    isDefault: true,
    values: joiningContext.rowIndices.map((indices) => indices[j] ?? ''),
  })

  // Intermediate properties to also explore (sub-objects on the path to the next array).
  // e.g. for hits[*] with nextSegment.properties = ['document', 'sampleOperations']:
  //   intermediateProps = ['document'] → also explore hits[*].document.*
  const nextSegment = segments[j + 1]
  const intermediateProps = nextSegment.properties.slice(0, -1)

  for (let step = 0; step <= intermediateProps.length; step++) {
    const pathPrefix =
      step === 0
        ? basePathPrefix
        : basePathPrefix + '.' + intermediateProps.slice(0, step).join('.')

    // Element at this sub-depth for each result row.
    const elementAtStep: any[] = elementForRow.map((el) => {
      let current = el
      for (let p = 0; p < step; p++) {
        if (current == null || typeof current !== 'object') return undefined
        current = current[intermediateProps[p]]
      }
      return current
    })

    // Collect all scalar-valued attribute keys at this level.
    const keysSet = new Set<string>()
    for (const el of elementAtStep) {
      if (el != null && typeof el === 'object' && !Array.isArray(el)) {
        for (const k of Object.keys(el)) {
          const v = el[k]
          if (v !== null && v !== undefined && typeof v !== 'object') keysSet.add(k)
        }
      }
    }

    for (const key of keysSet) {
      const perRowValues = elementAtStep.map((el) => {
        if (el == null || typeof el !== 'object') return ''
        const v = el[key]
        return v === null || v === undefined ? '' : String(v)
      })

      if (!perRowValues.every((v) => v !== '')) continue
      if (!perRowValues.every((v) => v.length <= 72)) continue

      // Uniqueness check: within each parent group (same indices 0..j-1), the
      // attribute values must be unique across all distinct element indices at level j.
      // This maps each (parentKey, elemIdx) pair to its value, then verifies
      // that no two distinct elemIdx values share a value within the same parentKey.
      const groupMaps = new Map<string, Map<number, string>>()
      for (let i = 0; i < resultCount; i++) {
        const rowIndices = joiningContext.rowIndices[i]
        const parentKey = rowIndices.slice(0, j).join(',')
        const elemIdx = parseInt(rowIndices[j], 10)
        if (!groupMaps.has(parentKey)) groupMaps.set(parentKey, new Map())
        groupMaps.get(parentKey)!.set(elemIdx, perRowValues[i])
      }

      let unique = true
      for (const elemMap of groupMaps.values()) {
        const vals = [...elemMap.values()]
        if (new Set(vals).size !== vals.length) { unique = false; break }
      }
      if (!unique) continue

      candidates.push({
        label: pathPrefix + '.' + key,
        path: pathPrefix + '.' + key,
        isDefault: false,
        values: perRowValues,
      })
    }
  }

  return candidates
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
