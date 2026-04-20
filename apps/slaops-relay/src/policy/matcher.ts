import type { Condition, RequestContext } from './types'

/** Operator suffixes stripped to resolve the context path. */
const OPERATOR_SUFFIXES = ['.in', '.lte', '.gte', '.matches'] as const

/** Strip operator suffix to get the dot-path into RequestContext. */
function normalizeKey(key: string): string {
  for (const suffix of OPERATOR_SUFFIXES) {
    if (key.endsWith(suffix)) return key.slice(0, -suffix.length)
  }
  return key
}

/** Traverse a nested object by dot-separated path (e.g. "host.isPrivateNetwork"). */
function getPathValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, segment) => {
    if (cur === undefined || cur === null) return undefined
    return (cur as Record<string, unknown>)[segment]
  }, obj)
}

/** Glob-style pattern match: `*` matches any sequence of characters, case-insensitive. */
function matchPatterns(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(
      '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      'i',
    )
    return regex.test(value)
  })
}

/** Evaluate a condition against the request context. */
export function matches(condition: Condition, ctx: RequestContext): boolean {
  if ('all' in condition) {
    return (condition as { all: Condition[] }).all.every((c) => matches(c, ctx))
  }
  if ('any' in condition) {
    return (condition as { any: Condition[] }).any.some((c) => matches(c, ctx))
  }
  if ('not' in condition) {
    return !matches((condition as { not: Condition }).not, ctx)
  }

  return Object.entries(condition as Record<string, unknown>).every(([key, expected]) => {
    const path = normalizeKey(key)
    const actual = getPathValue(ctx as unknown as Record<string, unknown>, path)

    if (key.endsWith('.in') && Array.isArray(expected)) {
      return (expected as unknown[]).includes(actual)
    }

    if (key.endsWith('.lte')) {
      return typeof actual === 'number' && actual <= Number(expected)
    }

    if (key.endsWith('.gte')) {
      return typeof actual === 'number' && actual >= Number(expected)
    }

    if (key.endsWith('.matches') && Array.isArray(expected)) {
      return matchPatterns(String(actual ?? ''), expected as string[])
    }

    if (typeof expected === 'object' && expected !== null && 'exists' in expected) {
      const present = actual !== undefined && actual !== null
      return present === Boolean((expected as { exists: boolean }).exists)
    }

    return actual === expected
  })
}
