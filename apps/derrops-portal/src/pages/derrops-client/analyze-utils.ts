import type { Service } from '@/client/derrops-cloud/models/service'
import type { KeyValuePair } from '@/hooks/useSendRequest'
import yaml from 'js-yaml'
import type { OperationOption } from './types'
import { HTTP_METHODS } from './types'

// ─── Spec loading ────────────────────────────────────────────────────────────

export async function parseOpenApiSpec(service: Service): Promise<any> {
  let specContent = service.openapi_doc_content

  if (!specContent && service.openapi_doc_url) {
    try {
      const response = await fetch(service.openapi_doc_url)
      specContent = await response.text()
    } catch {
      return null
    }
  }

  if (!specContent) return null

  try {
    return yaml.load(specContent)
  } catch {
    try {
      return JSON.parse(specContent)
    } catch {
      return null
    }
  }
}

export function extractOperationsFromSpec(spec: any): OperationOption[] {
  const operations: OperationOption[] = []

  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const methods = pathItem as Record<string, any>
      for (const method of HTTP_METHODS) {
        const lowerMethod = method.toLowerCase()
        if (methods[lowerMethod]) {
          operations.push({
            key: `${method}:${path}`,
            method,
            path,
            operationId: methods[lowerMethod].operationId,
            summary: methods[lowerMethod].summary,
            description: methods[lowerMethod].description,
          })
        }
      }
    }
  }

  return operations
}

// ─── URL / path matching ─────────────────────────────────────────────────────

export function matchUrlToPath(
  requestUrl: string,
  basePath: string,
  pathTemplate: string,
): boolean {
  try {
    const url = new URL(requestUrl)
    const requestPath = url.pathname

    let normalizedRequestPath = requestPath
    if (basePath && requestPath.startsWith(basePath)) {
      normalizedRequestPath = requestPath.slice(basePath.length) || '/'
    }

    const pathRegex = new RegExp('^' + pathTemplate.replace(/\{[^}]+\}/g, '[^/]+') + '$')
    return pathRegex.test(normalizedRequestPath)
  } catch {
    return false
  }
}

/** Extract path param values by matching URL segments to a template (e.g. /users/{id}). */
export function extractPathValues(
  requestUrl: string,
  pathTemplate: string,
): Record<string, string> {
  try {
    const urlObj = new URL(requestUrl)
    const requestPath = urlObj.pathname
    const templateParts = pathTemplate.split('/')
    const requestParts = requestPath.split('/')
    const values: Record<string, string> = {}

    templateParts.forEach((part, i) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        const paramName = part.slice(1, -1)
        values[paramName] = requestParts[i] || ''
      }
    })
    return values
  } catch {
    return {}
  }
}

/** Extract path param values using a regex-based approach (handles URL encoding). */
export function extractPathParamsFromUrl(
  url: string,
  pathTemplate: string,
): Record<string, string> {
  const pathParams: Record<string, string> = {}

  try {
    const urlObj = new URL(url)
    const urlPath = urlObj.pathname

    const paramNames: string[] = []
    const regexPattern = pathTemplate.replace(/\{([^}]+)\}/g, (_, paramName) => {
      paramNames.push(paramName)
      return '([^/]+)'
    })

    const regex = new RegExp(`^${regexPattern}$`)
    const match = urlPath.match(regex)

    if (match) {
      paramNames.forEach((paramName, index) => {
        pathParams[paramName] = match[index + 1]
      })
    }
  } catch {
    // Invalid URL or template
  }

  return pathParams
}

// ─── Value coercion ──────────────────────────────────────────────────────────

export function parseValueByType(value: string, schema: any): any {
  if (!schema) return value

  const type = schema.type

  if (type === 'boolean') return value === 'true' || value === '1'

  if (type === 'number') {
    const num = parseFloat(value)
    return isNaN(num) ? value : num
  }

  if (type === 'integer') {
    const num = parseInt(value, 10)
    return isNaN(num) ? value : num
  }

  if (type === 'array' || type === 'object') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  return value
}

// ─── Parameter validation ────────────────────────────────────────────────────

export function validateParamValue(
  value: string | null,
  type: string,
  required: boolean,
): { isValid: boolean; reason: string } {
  if (!value || value.trim() === '') {
    if (required) return { isValid: false, reason: 'Required parameter is missing' }
    return { isValid: true, reason: 'Optional parameter not provided' }
  }

  switch (type) {
    case 'integer':
      if (!/^-?\d+$/.test(value)) {
        return { isValid: false, reason: `Expected integer, got "${value}"` }
      }
      break
    case 'number':
      if (isNaN(Number(value))) {
        return { isValid: false, reason: `Expected number, got "${value}"` }
      }
      break
    case 'boolean':
      if (!['true', 'false'].includes(value.toLowerCase())) {
        return { isValid: false, reason: `Expected boolean (true/false), got "${value}"` }
      }
      break
  }

  return { isValid: true, reason: 'Value matches expected type' }
}

const COMMON_HEADERS = [
  'content-type',
  'accept',
  'authorization',
  'user-agent',
  'host',
  'connection',
  'cache-control',
]

export function validateRequest(
  _spec: any,
  operation: any,
  requestBody: string,
  requestHeaders: KeyValuePair[],
  requestQueryParams: KeyValuePair[],
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (operation.requestBody?.required && !requestBody.trim()) {
    errors.push('Request body is required but not provided')
  }

  const contentTypeHeader = requestHeaders.find(
    (h) => h.enabled && h.key.toLowerCase() === 'content-type',
  )
  if (contentTypeHeader?.value.includes('application/json') && requestBody.trim()) {
    try {
      JSON.parse(requestBody)
    } catch {
      errors.push('Request body is not valid JSON')
    }
  }

  const specQueryParams = (operation.parameters || [])
    .filter((p: any) => p.in === 'query')
    .map((p: any) => p.name.toLowerCase())

  const specHeaderParams = (operation.parameters || [])
    .filter((p: any) => p.in === 'header')
    .map((p: any) => p.name.toLowerCase())

  const unspecifiedQueryParams = requestQueryParams.filter(
    (p) => p.enabled && p.key.trim() && !specQueryParams.includes(p.key.toLowerCase()),
  )
  for (const param of unspecifiedQueryParams) {
    warnings.push(`Query parameter "${param.key}" is not defined in the OpenAPI specification`)
  }

  const unspecifiedHeaders = requestHeaders.filter(
    (h) =>
      h.enabled &&
      h.key.trim() &&
      !specHeaderParams.includes(h.key.toLowerCase()) &&
      !COMMON_HEADERS.includes(h.key.toLowerCase()),
  )
  for (const header of unspecifiedHeaders) {
    warnings.push(`Header "${header.key}" is not defined in the OpenAPI specification`)
  }

  if (operation.parameters) {
    const requiredParams = operation.parameters.filter((p: any) => p.required)
    for (const param of requiredParams) {
      if (param.in === 'header') {
        const found = requestHeaders.find(
          (h) => h.enabled && h.key.toLowerCase() === param.name.toLowerCase(),
        )
        if (!found || !found.value) {
          errors.push(`Required header "${param.name}" is missing`)
        }
      }
      if (param.in === 'query') {
        const found = requestQueryParams.find(
          (p) => p.enabled && p.key.toLowerCase() === param.name.toLowerCase(),
        )
        if (!found || !found.value) {
          errors.push(`Required query parameter "${param.name}" is missing`)
        }
      }
    }
  }

  return { errors, warnings }
}
