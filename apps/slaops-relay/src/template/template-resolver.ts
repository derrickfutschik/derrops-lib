import { randomBytes, randomUUID } from 'crypto'
import { SecretStore, SecretStoreError } from '../secrets/secret-store'

export type InjectedSecret = { id: string; value: string }

export type ResolveResult<T> = { value: T; injectedSecrets: InjectedSecret[] }

/** Thrown when a template expression cannot be resolved. */
export class TemplateError extends Error {
  constructor(
    message: string,
    public readonly expression: string,
  ) {
    super(message)
    this.name = 'TemplateError'
  }
}

const EXPR_REGEX = /\{\{([^}]+)\}\}/g

/**
 * Resolve all {{expr}} placeholders in a single string.
 * Returns the resolved string and a list of secrets that were injected
 * (used later by the secret masker).
 */
async function resolveString(
  raw: string,
  secretStore: SecretStore,
  variables: Record<string, unknown>,
  injected: InjectedSecret[],
): Promise<string> {
  const matches = [...raw.matchAll(EXPR_REGEX)]
  if (matches.length === 0) return raw

  let result = raw
  // Process in reverse order so replacement indices stay valid
  for (const match of [...matches].reverse()) {
    const expr = match[1].trim()
    const resolved = await resolveExpression(expr, secretStore, variables, injected)
    result = result.slice(0, match.index!) + resolved + result.slice(match.index! + match[0].length)
  }
  return result
}

async function resolveExpression(
  expr: string,
  secretStore: SecretStore,
  variables: Record<string, unknown>,
  injected: InjectedSecret[],
): Promise<string> {
  const colonIdx = expr.indexOf(':')
  if (colonIdx === -1) {
    throw new TemplateError(`Unknown expression syntax '{{${expr}}}'`, expr)
  }

  const type = expr.slice(0, colonIdx).trim()
  const qualifier = expr.slice(colonIdx + 1).trim()

  switch (type) {
    case 'secret':
      return resolveSecret(qualifier, secretStore, injected)

    case 'jit':
      return resolveJit(qualifier, expr)

    case 'var':
      return resolveVar(qualifier, variables, expr)

    default:
      throw new TemplateError(`Unknown expression type '${type}' in '{{${expr}}}'`, expr)
  }
}

async function resolveSecret(
  qualifier: string,
  store: SecretStore,
  injected: InjectedSecret[],
): Promise<string> {
  const dotIdx = qualifier.indexOf('.')
  const secretId = dotIdx === -1 ? qualifier : qualifier.slice(0, dotIdx)
  const field = dotIdx === -1 ? undefined : qualifier.slice(dotIdx + 1)

  try {
    const result = field
      ? await store.getSecretField(secretId, field)
      : await store.getSecret(secretId)

    injected.push({ id: qualifier, value: result.value })
    return result.value
  } catch (err) {
    if (err instanceof SecretStoreError) {
      throw new TemplateError(
        `Failed to resolve secret '${qualifier}': ${err.message}`,
        `secret:${qualifier}`,
      )
    }
    throw err
  }
}

function resolveJit(qualifier: string, expr: string): string {
  const [fn, ...args] = qualifier.split(':')

  switch (fn) {
    case 'uuid':
      return randomUUID()

    case 'uuid-short':
      return randomUUID().replace(/-/g, '').slice(0, 8)

    case 'timestamp':
      return new Date().toISOString()

    case 'timestamp-unix':
      return String(Math.floor(Date.now() / 1000))

    case 'timestamp-unix-ms':
      return String(Date.now())

    case 'random-hex': {
      const n = parseInt(args[0] ?? '16', 10)
      if (isNaN(n) || n <= 0) {
        throw new TemplateError(`Invalid length for jit:random-hex in '{{${expr}}}'`, expr)
      }
      return randomBytes(Math.ceil(n / 2))
        .toString('hex')
        .slice(0, n)
    }

    default:
      throw new TemplateError(`Unknown jit function '${fn}' in '{{${expr}}}'`, expr)
  }
}

function resolveVar(
  name: string,
  variables: Record<string, unknown>,
  expr: string,
): string {
  if (!(name in variables)) {
    throw new TemplateError(
      `Variable '${name}' not defined in templateContext.variables`,
      expr,
    )
  }
  return String(variables[name])
}

/**
 * Resolve all {{expr}} placeholders in every string field of a HAR request
 * (url, header values, query param values, cookie values, postData.text,
 * postData.params values).
 *
 * Returns the mutated copy of the object plus all secrets that were injected.
 */
export async function resolveTemplates<T extends Record<string, unknown>>(
  har: T,
  secretStore: SecretStore,
  variables: Record<string, unknown> = {},
): Promise<ResolveResult<T>> {
  const injectedSecrets: InjectedSecret[] = []

  async function walk(value: unknown): Promise<unknown> {
    if (typeof value === 'string') {
      return resolveString(value, secretStore, variables, injectedSecrets)
    }
    if (Array.isArray(value)) {
      return Promise.all(value.map(walk))
    }
    if (typeof value === 'object' && value !== null) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) {
        out[k] = await walk(v)
      }
      return out
    }
    return value
  }

  const resolved = (await walk(har)) as T
  return { value: resolved, injectedSecrets }
}
