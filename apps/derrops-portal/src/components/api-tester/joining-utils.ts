export interface JoiningContext {
  joiningColumns: string[]
  rowIndices: string[][]
}

export interface JoinColumnCandidate {
  isDefault: boolean
  values: string[]
}

function navigatePath(obj: unknown, path: string): unknown {
  const cleaned = path.replace(/^\./, '')
  if (!cleaned) return obj
  const parts = cleaned.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function buildRowIndices(
  data: unknown,
  segments: string[],
  joiningColumnCount: number,
): string[][] {
  const n = segments.length - 1

  function recurse(element: unknown, segmentIndex: number, currentIndices: string[]): string[][] {
    if (segmentIndex === n) return [currentIndices]

    const arr = navigatePath(element, segments[segmentIndex])
    if (!Array.isArray(arr)) return []

    const results: string[][] = []
    for (let j = 0; j < arr.length; j++) {
      const newIndices =
        segmentIndex < joiningColumnCount ? [...currentIndices, String(j)] : currentIndices
      results.push(...recurse(arr[j] as unknown, segmentIndex + 1, newIndices))
    }
    return results
  }

  return recurse(data, 0, [])
}

export function detectJoiningContext(
  data: unknown,
  query: string,
  resultCount: number,
): JoiningContext | null {
  const segments = query.split('[*]')
  if (segments.length < 2) return null

  const arrayNames: string[] = []
  for (let i = 0; i < segments.length - 1; i++) {
    const parts = segments[i].replace(/^\./, '').split('.')
    arrayNames.push(parts[parts.length - 1])
  }

  const hasTrailingProp = segments[segments.length - 1].length > 0

  if (!hasTrailingProp && arrayNames.length === 1) return null

  const joiningColumns = hasTrailingProp ? [...arrayNames] : arrayNames.slice(0, -1)

  const rowIndices = buildRowIndices(data, segments, joiningColumns.length)
  if (rowIndices.length !== resultCount) return null

  return { joiningColumns, rowIndices }
}

export function detectJoinColumnCandidates(
  data: unknown,
  query: string,
  ctx: JoiningContext,
): JoinColumnCandidate[][] {
  const segments = query.split('[*]')

  return ctx.joiningColumns.map((_, level) => {
    const arr = navigatePath(data, segments[level])
    const length = Array.isArray(arr) ? arr.length : 0
    return [{ isDefault: true, values: Array.from({ length }, (_, i) => String(i)) }]
  })
}
