import { MatchResult } from './types'

export function deliveryModeBadgeLabel(mode: string): string {
  if (mode === 'platform-queue') return 'SQS'
  if (mode === 'hybrid') return 'HTTP+SQS'
  return 'HTTP'
}

/**
 * Extract validation errors from match result to display in response JSON tooltips.
 */
export function extractValidationErrors(matchResult: MatchResult | null): Record<string, string> {
  if (!matchResult?.operation) return {}

  const errors: Record<string, string> = {}

  const allParameters = [
    ...(matchResult.operation.pathParameters || []),
    ...(matchResult.operation.queryParameters || []),
    ...(matchResult.operation.headerParameters || []),
    ...(matchResult.operation.bodyProperties || []),
  ]

  allParameters.forEach((param) => {
    if (!param.isValid && param.validationReason) {
      errors[param.name] = param.validationReason
    }
  })

  return errors
}

/**
 * Extract response schema from OpenAPI spec based on HTTP status code.
 * Looks for exact status code match first, then falls back to default or 2xx pattern.
 */
export function getResponseSchemaForStatus(
  matchResult: MatchResult | null,
  statusCode: number,
): any {
  if (!matchResult?.operation || !matchResult?.spec) return undefined

  const { spec, operation } = matchResult
  const { paths } = spec

  if (!paths || !paths[operation.path]) return undefined

  const pathMethods = paths[operation.path]
  const lowerMethod = operation.method.toLowerCase()
  const operationDef = pathMethods[lowerMethod]

  if (!operationDef?.responses) return undefined

  const statusString = String(statusCode)
  const statusPattern = `${statusString[0]}XX`

  const responseToCheck =
    operationDef.responses[statusString] ||
    operationDef.responses[statusPattern] ||
    operationDef.responses['default']

  if (!responseToCheck?.content) return undefined

  const jsonContent = Object.keys(responseToCheck.content).find((ct) => ct.includes('json'))

  if (jsonContent && responseToCheck.content[jsonContent]?.schema) {
    return responseToCheck.content[jsonContent].schema
  }

  return undefined
}
