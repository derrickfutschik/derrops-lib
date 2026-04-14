import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { Service } from '@/client/slaops-cloud/models/service'
import type { KeyValuePair } from '@/hooks/useSendRequest'
import type { BodyType } from '@/components/api-tester/RequestBodyEditor'
import type { OpenAPIFormValues } from '@/components/api-tester/OpenAPIParameterForm'
import type {
  MatchResult,
  OperationOption,
  ParameterInfo,
  ServerVariable,
  ServerInfo,
  BodyPropertyInfo,
  BuilderMode,
} from './types'
import {
  parseOpenApiSpec,
  extractOperationsFromSpec,
  matchUrlToPath,
  extractPathValues,
  validateParamValue,
  validateRequest,
} from './analyze-utils'

interface UseAnalyzeRequestParams {
  url: string
  method: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  body: string
  bodyType: BodyType
  services: Service[]
  builderMode: BuilderMode
  openAPIOperation: any
  openAPIFormValues: OpenAPIFormValues
  openAPIServerUrl: string
  selectedServiceId: string | null
  selectedOperationKey: string | null
  matchMode: 'auto' | 'manual'
  onClearSelectedOperationKey: () => void
}

interface UseAnalyzeRequestReturn {
  matchResult: MatchResult | null
  isAnalyzing: boolean
  availableOperations: OperationOption[]
  analyzeRequest: () => Promise<void>
}

export function useAnalyzeRequest({
  url,
  method,
  headers,
  queryParams,
  body,
  bodyType,
  services,
  builderMode,
  openAPIOperation,
  openAPIFormValues,
  openAPIServerUrl,
  selectedServiceId,
  selectedOperationKey,
  matchMode,
  onClearSelectedOperationKey,
}: UseAnalyzeRequestParams): UseAnalyzeRequestReturn {
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [parsedSpecs, setParsedSpecs] = useState<Record<string, any>>({})
  const [availableOperations, setAvailableOperations] = useState<OperationOption[]>([])

  // Load operations when selected service changes (for the manual match panel dropdowns)
  useEffect(() => {
    const loadOperations = async () => {
      if (!selectedServiceId) {
        setAvailableOperations([])
        onClearSelectedOperationKey()
        return
      }

      const service = services.find((s) => s.id === selectedServiceId)
      if (!service) return

      if (parsedSpecs[selectedServiceId]) {
        setAvailableOperations(extractOperationsFromSpec(parsedSpecs[selectedServiceId]))
        return
      }

      const spec = await parseOpenApiSpec(service)
      if (spec) {
        setParsedSpecs((prev) => ({ ...prev, [selectedServiceId]: spec }))
        setAvailableOperations(extractOperationsFromSpec(spec))
      }
    }

    loadOperations()
  }, [selectedServiceId, services])

  const analyzeRequest = async () => {
    let requestUrl = url
    if (builderMode === 'openapi' && openAPIOperation && openAPIServerUrl) {
      let fullPath = openAPIOperation.path
      if (openAPIFormValues.pathParams) {
        Object.entries(openAPIFormValues.pathParams).forEach(([key, value]) => {
          fullPath = fullPath.replace(`{${key}}`, encodeURIComponent(String(value || '')))
        })
      }
      requestUrl = `${openAPIServerUrl.replace(/\/$/, '')}${fullPath}`
    }

    if (!requestUrl.trim()) {
      toast.error('Please enter a URL')
      return
    }

    const startTime = Date.now()
    setIsAnalyzing(true)
    setMatchResult(null)

    try {
      let matchedService: Service | null = null
      let matchedServer: ServerInfo | null = null
      let matchedOperation: MatchResult['operation'] = null
      let spec: any = null
      let validationErrors: string[] = []
      let validationWarnings: string[] = []

      const buildOperationResult = (
        service: Service,
        specDoc: any,
        pathTemplate: string,
        opMethod: string,
      ) => {
        const pathMethods = specDoc.paths[pathTemplate] as Record<string, any>
        const lowerMethod = opMethod.toLowerCase()
        const operationDef = pathMethods[lowerMethod]
        if (!operationDef) return null

        const servers = specDoc.servers || [{ url: '/' }]
        const server = servers[0]
        const serverUrl = server.url

        const serverVariables: ServerVariable[] = []
        if (server.variables) {
          for (const [varName, varDef] of Object.entries(
            server.variables as Record<string, any>,
          )) {
            serverVariables.push({
              name: varName,
              value: varDef.default || '',
              default: varDef.default || '',
              description: varDef.description,
              enum: varDef.enum,
            })
          }
        }

        let resolvedUrl = serverUrl
        serverVariables.forEach((v) => {
          resolvedUrl = resolvedUrl.replace(`{${v.name}}`, v.value)
        })

        const serverInfo: ServerInfo = {
          index: 0,
          url: serverUrl,
          resolvedUrl,
          description: server.description,
          variables: serverVariables,
        }

        const parameters = operationDef.parameters || []
        const pathValues = extractPathValues(requestUrl, pathTemplate)

        const pathParameters: ParameterInfo[] = parameters
          .filter((p: any) => p.in === 'path')
          .map((p: any) => {
            const value = pathValues[p.name] || null
            const defaultValue =
              p.schema?.default !== undefined ? String(p.schema.default) : null
            const isUsingDefault = value === null && defaultValue !== null
            const effectiveValue = value ?? defaultValue
            const validation = validateParamValue(
              effectiveValue,
              p.schema?.type || 'string',
              p.required ?? true,
            )
            return {
              name: p.name,
              type: p.schema?.type || 'string',
              required: p.required ?? true,
              value,
              defaultValue,
              isUsingDefault,
              isUnspecified: false,
              isValid: validation.isValid,
              validationReason: validation.reason,
              description: p.description,
              rawJson: p,
            }
          })

        const specQueryParamNames = parameters
          .filter((p: any) => p.in === 'query')
          .map((p: any) => p.name.toLowerCase())

        const queryParameters: ParameterInfo[] = parameters
          .filter((p: any) => p.in === 'query')
          .map((p: any) => {
            const queryParam = queryParams.find(
              (qp) => qp.enabled && qp.key.toLowerCase() === p.name.toLowerCase(),
            )
            const value = queryParam?.value || null
            const defaultValue =
              p.schema?.default !== undefined ? String(p.schema.default) : null
            const isUsingDefault = value === null && defaultValue !== null
            const effectiveValue = value ?? defaultValue
            const validation = validateParamValue(
              effectiveValue,
              p.schema?.type || 'string',
              p.required ?? false,
            )
            return {
              name: p.name,
              type: p.schema?.type || 'string',
              required: p.required ?? false,
              value,
              defaultValue,
              isUsingDefault,
              isUnspecified: false,
              isValid: validation.isValid,
              validationReason: validation.reason,
              description: p.description,
              rawJson: p,
            }
          })

        const unspecifiedQueryParams: ParameterInfo[] = queryParams
          .filter(
            (qp) =>
              qp.enabled &&
              qp.key.trim() &&
              !specQueryParamNames.includes(qp.key.toLowerCase()),
          )
          .map((qp) => ({
            name: qp.key,
            type: 'unknown',
            required: false,
            value: qp.value,
            defaultValue: null,
            isUsingDefault: false,
            isUnspecified: true,
            isValid: true,
            validationReason: 'Parameter not in specification',
            description: undefined,
            rawJson: {},
          }))

        queryParameters.push(...unspecifiedQueryParams)

        const specHeaderParamNames = parameters
          .filter((p: any) => p.in === 'header')
          .map((p: any) => p.name.toLowerCase())

        const COMMON_HEADERS = [
          'content-type', 'accept', 'authorization', 'user-agent',
          'host', 'connection', 'cache-control',
        ]

        const headerParameters: ParameterInfo[] = parameters
          .filter((p: any) => p.in === 'header')
          .map((p: any) => {
            const headerParam = headers.find(
              (h) => h.enabled && h.key.toLowerCase() === p.name.toLowerCase(),
            )
            const value = headerParam?.value || null
            const defaultValue =
              p.schema?.default !== undefined ? String(p.schema.default) : null
            const isUsingDefault = value === null && defaultValue !== null
            const effectiveValue = value ?? defaultValue
            const validation = validateParamValue(
              effectiveValue,
              p.schema?.type || 'string',
              p.required ?? false,
            )
            return {
              name: p.name,
              type: p.schema?.type || 'string',
              required: p.required ?? false,
              value,
              defaultValue,
              isUsingDefault,
              isUnspecified: false,
              isValid: validation.isValid,
              validationReason: validation.reason,
              description: p.description,
              rawJson: p,
            }
          })

        const unspecifiedHeaderParams: ParameterInfo[] = headers
          .filter(
            (h) =>
              h.enabled &&
              h.key.trim() &&
              !specHeaderParamNames.includes(h.key.toLowerCase()) &&
              !COMMON_HEADERS.includes(h.key.toLowerCase()),
          )
          .map((h) => ({
            name: h.key,
            type: 'unknown',
            required: false,
            value: h.value,
            defaultValue: null,
            isUsingDefault: false,
            isUnspecified: true,
            isValid: true,
            validationReason: 'Parameter not in specification',
            description: undefined,
            rawJson: {},
          }))

        headerParameters.push(...unspecifiedHeaderParams)

        const bodyProperties: BodyPropertyInfo[] = []
        let bodyContentType: string | undefined

        if (operationDef.requestBody) {
          const content = operationDef.requestBody.content
          if (content) {
            const jsonContentType = Object.keys(content).find((ct) => ct.includes('json'))
            bodyContentType = jsonContentType || Object.keys(content)[0]

            if (bodyContentType && content[bodyContentType]?.schema) {
              const schema = content[bodyContentType].schema
              const requiredFields = schema.required || []

              let parsedBody: Record<string, any> = {}
              if (body.trim()) {
                try {
                  parsedBody = JSON.parse(body)
                } catch {
                  // Body is not valid JSON
                }
              }

              if (schema.properties) {
                for (const [propName, propDef] of Object.entries(
                  schema.properties as Record<string, any>,
                )) {
                  const isRequired = requiredFields.includes(propName)
                  const value = parsedBody[propName]
                  const propType = propDef.type || 'any'

                  let isValid = true
                  let validationReason = 'Value matches expected type'

                  if (value === undefined || value === null) {
                    if (isRequired) {
                      isValid = false
                      validationReason = 'Required property is missing'
                    } else {
                      validationReason = 'Optional property not provided'
                    }
                  } else {
                    switch (propType) {
                      case 'string':
                        if (typeof value !== 'string') {
                          isValid = false
                          validationReason = `Expected string, got ${typeof value}`
                        }
                        break
                      case 'integer':
                        if (!Number.isInteger(value)) {
                          isValid = false
                          validationReason = `Expected integer, got ${typeof value}`
                        }
                        break
                      case 'number':
                        if (typeof value !== 'number') {
                          isValid = false
                          validationReason = `Expected number, got ${typeof value}`
                        }
                        break
                      case 'boolean':
                        if (typeof value !== 'boolean') {
                          isValid = false
                          validationReason = `Expected boolean, got ${typeof value}`
                        }
                        break
                      case 'array':
                        if (!Array.isArray(value)) {
                          isValid = false
                          validationReason = `Expected array, got ${typeof value}`
                        }
                        break
                      case 'object':
                        if (typeof value !== 'object' || Array.isArray(value)) {
                          isValid = false
                          validationReason = `Expected object, got ${typeof value}`
                        }
                        break
                    }
                  }

                  bodyProperties.push({
                    name: propName,
                    type: propType,
                    required: isRequired,
                    value: value !== undefined ? value : null,
                    isValid,
                    validationReason,
                    description: propDef.description,
                    rawJson: propDef,
                  })
                }
              }
            }
          }
        }

        let responseSchema: any = undefined
        if (operationDef.responses) {
          const successResponse =
            operationDef.responses['200'] ||
            operationDef.responses['201'] ||
            operationDef.responses['default']
          if (successResponse?.content) {
            const jsonContent = Object.keys(successResponse.content).find((ct) =>
              ct.includes('json'),
            )
            if (jsonContent && successResponse.content[jsonContent]?.schema) {
              responseSchema = successResponse.content[jsonContent].schema
            }
          }
        }

        const operation: MatchResult['operation'] = {
          path: pathTemplate,
          method: opMethod,
          operationId: operationDef.operationId,
          summary: operationDef.summary,
          description: operationDef.description,
          pathParameters,
          queryParameters,
          headerParameters,
          bodyProperties,
          bodyContentType,
          responseSchema,
        }

        const validationResult = validateRequest(specDoc, operationDef, body, headers, queryParams)

        return {
          service,
          serverInfo,
          operation,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        }
      }

      const useLockedSelection =
        (matchMode === 'manual' || builderMode === 'openapi') &&
        selectedServiceId &&
        selectedOperationKey

      if (useLockedSelection) {
        const service = services.find((s) => s.id === selectedServiceId)
        if (service) {
          spec = parsedSpecs[selectedServiceId!] || (await parseOpenApiSpec(service))
          if (spec) {
            const [opMethod, ...pathParts] = selectedOperationKey!.split(':')
            const pathTemplate = pathParts.join(':')
            const result = buildOperationResult(service, spec, pathTemplate, opMethod)
            if (result) {
              matchedService = result.service
              matchedServer = result.serverInfo
              matchedOperation = result.operation
              validationErrors = result.errors
              validationWarnings = result.warnings
            }
          }
        }
      } else {
        for (const service of services) {
          spec = await parseOpenApiSpec(service)
          if (!spec) continue

          const servers = spec.servers || [{ url: '/' }]

          for (let serverIndex = 0; serverIndex < servers.length; serverIndex++) {
            const server = servers[serverIndex]
            const serverUrl = server.url

            const serverVariables: ServerVariable[] = []
            if (server.variables) {
              for (const [varName, varDef] of Object.entries(
                server.variables as Record<string, any>,
              )) {
                serverVariables.push({
                  name: varName,
                  value: varDef.default || '',
                  default: varDef.default || '',
                  description: varDef.description,
                  enum: varDef.enum,
                })
              }
            }

            let resolvedUrl = serverUrl
            serverVariables.forEach((v) => {
              resolvedUrl = resolvedUrl.replace(`{${v.name}}`, v.value)
            })

            if (spec.paths) {
              for (const [pathTemplate, pathItem] of Object.entries(spec.paths)) {
                const pathMethods = pathItem as Record<string, any>
                const lowerMethod = method.toLowerCase()

                if (pathMethods[lowerMethod] && matchUrlToPath(requestUrl, serverUrl, pathTemplate)) {
                  matchedService = service
                  matchedServer = {
                    index: serverIndex,
                    url: serverUrl,
                    resolvedUrl,
                    description: server.description,
                    variables: serverVariables,
                  }

                  // Reuse buildOperationResult for auto-match path
                  const result = buildOperationResult(service, spec, pathTemplate, method)
                  if (result) {
                    matchedOperation = result.operation
                    validationErrors = result.errors
                    validationWarnings = result.warnings
                  }
                  break
                }
              }
            }

            if (matchedOperation) break
          }

          if (matchedOperation) break
        }
      }

      setMatchResult({
        matched: !!matchedOperation,
        service: matchedService,
        server: matchedServer,
        operation: matchedOperation,
        validationErrors,
        validationWarnings,
        spec,
      })

      if (!matchedOperation) {
        if (matchMode === 'manual') {
          toast.info('Selected operation not found - check your selection')
        } else {
          toast.info('No matching API endpoint found in your services')
        }
      }
    } catch {
      toast.error('Failed to analyze request')
    } finally {
      const elapsed = Date.now() - startTime
      if (elapsed < 500) {
        await new Promise((resolve) => setTimeout(resolve, 500 - elapsed))
      }
      setIsAnalyzing(false)
    }
  }

  return { matchResult, isAnalyzing, availableOperations, analyzeRequest }
}
