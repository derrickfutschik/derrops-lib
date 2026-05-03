import type { OpenAPIFormValues } from '@/components/derrops-client/OpenAPIParameterForm'
import type { BodyType, RawType } from '@/components/derrops-client/RequestBodyEditor'
import type { KeyValuePair } from '@/hooks/useSendRequest'
import { useEffect, useRef } from 'react'
import { extractPathParamsFromUrl, parseValueByType } from './analyze-utils'
import type { BuilderMode } from './types'

interface UseOpenAPIFormSyncParams {
  builderMode: BuilderMode
  openAPIOperation: any
  openAPIServerUrl: string
  openAPIFormValues: OpenAPIFormValues
  setOpenAPIFormValues: (v: OpenAPIFormValues) => void
  queryParams: KeyValuePair[]
  setQueryParams: (v: KeyValuePair[]) => void
  headers: KeyValuePair[]
  setHeaders: (v: KeyValuePair[]) => void
  url: string
  setUrl: (v: string) => void
  setMethod: (v: string) => void
  body: string
  bodyType: BodyType
  rawType: RawType
  setBody: (v: string) => void
  setBodyType: (v: BodyType) => void
  setRawType: (v: RawType) => void
}

/**
 * Manages bidirectional sync between OpenAPI form state and Standard mode tab state.
 * Anti-oscillation strategy: refs track last sync direction + timestamp to prevent bouncing.
 */
export function useOpenAPIFormSync({
  builderMode,
  openAPIOperation,
  openAPIServerUrl,
  openAPIFormValues,
  setOpenAPIFormValues,
  queryParams,
  setQueryParams,
  headers,
  setHeaders,
  url,
  setUrl,
  setMethod,
  body,
  bodyType,
  rawType,
  setBody,
  setBodyType,
  setRawType,
}: UseOpenAPIFormSyncParams): void {
  const lastSyncedFormValuesRef = useRef<OpenAPIFormValues>(openAPIFormValues)
  const lastSyncInfoRef = useRef<{ direction: 'toTabs' | 'toForm' | null; timestamp: number }>({
    direction: null,
    timestamp: 0,
  })
  const openAPIServerUrlRef = useRef(openAPIServerUrl)
  openAPIServerUrlRef.current = openAPIServerUrl

  // Direction 1: OpenAPI form → Standard tabs (url, method, headers, queryParams, body)
  useEffect(() => {
    if (builderMode !== 'openapi' || !openAPIOperation) return

    const isFormEmpty =
      Object.keys(openAPIFormValues.queryParams).length === 0 &&
      Object.keys(openAPIFormValues.headerParams).length === 0 &&
      Object.keys(openAPIFormValues.pathParams).length === 0 &&
      Object.keys(openAPIFormValues.bodyParams).length === 0

    // Always sync URL and method when operation changes
    let fullPath = openAPIOperation.path
    if (openAPIFormValues.pathParams) {
      Object.entries(openAPIFormValues.pathParams).forEach(([key, value]) => {
        fullPath = fullPath.replace(`{${key}}`, String(value || `{${key}}`))
      })
    }
    const baseUrl = openAPIServerUrlRef.current.replace(/\/$/, '')
    setUrl(baseUrl ? `${baseUrl}${fullPath}` : fullPath)
    setMethod(openAPIOperation.method)

    if (isFormEmpty && lastSyncInfoRef.current.direction === null) return

    const now = Date.now()
    const lastSync = lastSyncInfoRef.current

    if (lastSync.direction === 'toForm' && now - lastSync.timestamp < 50) {
      if (openAPIFormValues === lastSyncedFormValuesRef.current) return
    }

    lastSyncedFormValuesRef.current = openAPIFormValues
    lastSyncInfoRef.current = { direction: 'toTabs', timestamp: now }

    const newQueryParams: KeyValuePair[] = Object.entries(openAPIFormValues.queryParams)
      .filter(([_, value]) => {
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return true
        return value !== undefined && value !== null && value !== ''
      })
      .map(([key, value]) => ({
        key,
        value:
          Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value),
        enabled: true,
      }))
    newQueryParams.push({ key: '', value: '', enabled: true })
    setQueryParams(newQueryParams)

    const newHeaders: KeyValuePair[] = Object.entries(openAPIFormValues.headerParams)
      .filter(([_, value]) => {
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return true
        return value !== undefined && value !== null && value !== ''
      })
      .map(([key, value]) => ({
        key,
        value:
          Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value),
        enabled: true,
      }))
    if (!newHeaders.some((h) => h.key.toLowerCase() === 'content-type')) {
      newHeaders.push({ key: 'Content-Type', value: 'application/json', enabled: true })
    }
    setHeaders(newHeaders)

    if (Object.keys(openAPIFormValues.bodyParams).length > 0) {
      setBody(JSON.stringify(openAPIFormValues.bodyParams, null, 2))
      setBodyType('raw')
      setRawType('json')
    }
  }, [openAPIFormValues, builderMode, openAPIOperation])

  // Direction 2: Standard tabs → OpenAPI form
  useEffect(() => {
    if (builderMode !== 'openapi' || !openAPIOperation) return

    const now = Date.now()
    const lastSync = lastSyncInfoRef.current

    const parameters = openAPIOperation.parameters || []

    const syncedQueryParams: Record<string, any> = {}
    parameters
      .filter((p: any) => p.in === 'query')
      .forEach((param: any) => {
        const existing = queryParams.find((p) => p.key === param.name && p.enabled)
        if (existing && existing.value) {
          syncedQueryParams[param.name] = parseValueByType(existing.value, param.schema)
        }
      })

    const syncedHeaderParams: Record<string, any> = {}
    parameters
      .filter((p: any) => p.in === 'header')
      .forEach((param: any) => {
        const existing = headers.find(
          (h) => h.key.toLowerCase() === param.name.toLowerCase() && h.enabled,
        )
        if (existing && existing.value) {
          syncedHeaderParams[param.name] = parseValueByType(existing.value, param.schema)
        }
      })

    const syncedPathParams: Record<string, any> = { ...openAPIFormValues.pathParams }
    const opPathParams = parameters.filter((p: any) => p.in === 'path')

    const formPathParamsEmpty =
      Object.keys(openAPIFormValues.pathParams).length === 0 ||
      Object.values(openAPIFormValues.pathParams).every(
        (v) => v === undefined || v === null || v === '',
      )

    if (formPathParamsEmpty && url && openAPIOperation.path) {
      const extractedParams = extractPathParamsFromUrl(url, openAPIOperation.path)
      opPathParams.forEach((param: any) => {
        if (extractedParams[param.name]) {
          const rawValue = extractedParams[param.name]
          try {
            const decoded = decodeURIComponent(rawValue)
            if (decoded === `{${param.name}}`) return
          } catch {
            // decodeURIComponent failed, use raw value
          }
          syncedPathParams[param.name] = parseValueByType(rawValue, param.schema)
        }
      })
    }

    let syncedBodyParams: Record<string, any> = {}
    if (bodyType === 'raw' && rawType === 'json' && body) {
      try {
        syncedBodyParams = JSON.parse(body)
      } catch {
        // Invalid JSON, ignore
      }
    }

    if (lastSync.direction === 'toTabs' && now - lastSync.timestamp < 50) return

    const normalize = (obj: Record<string, any>): string => {
      const sorted: Record<string, any> = {}
      Object.keys(obj)
        .sort()
        .forEach((key) => {
          sorted[key] = obj[key]
        })
      return JSON.stringify(sorted)
    }

    const lastSynced = lastSyncedFormValuesRef.current
    const changed =
      normalize(syncedQueryParams) !== normalize(lastSynced.queryParams) ||
      normalize(syncedHeaderParams) !== normalize(lastSynced.headerParams) ||
      normalize(syncedPathParams) !== normalize(lastSynced.pathParams) ||
      normalize(syncedBodyParams) !== normalize(lastSynced.bodyParams)

    if (changed) {
      const newFormValues = {
        pathParams: syncedPathParams,
        queryParams: syncedQueryParams,
        headerParams: syncedHeaderParams,
        bodyParams: syncedBodyParams,
      }
      lastSyncedFormValuesRef.current = newFormValues
      lastSyncInfoRef.current = { direction: 'toForm', timestamp: now }
      setOpenAPIFormValues(newFormValues)
    }
  }, [builderMode, queryParams, headers, url, body, bodyType, rawType, openAPIOperation])
}
