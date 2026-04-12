import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useAppDispatch } from '@/store/hooks'
import { setIsSendingRequest, setRequestResponse } from '@/store/apiRequestSlice'
import type { OpenAPIFormValues } from '@/components/api-tester/OpenAPIParameterForm'
import type { BodyType, FormDataEntry, RawType } from '@/components/api-tester/RequestBodyEditor'
import { useRelayJob } from './useRelayJob'
import { useRelaySelector } from './useRelaySelector'

// ── Types ──────────────────────────────────────────────────────────────────

export interface KeyValuePair {
  key: string
  value: string
  enabled: boolean
}

export interface SendRequestParams {
  url: string
  method: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  body: string
  bodyType: BodyType
  rawType: RawType
  formData: FormDataEntry[]
  builderMode: 'standard' | 'openapi'
  openAPIOperation: any
  openAPIServerUrl: string
  openAPIFormValues: OpenAPIFormValues
  openAPIServiceId: string | null
  openAPIOperationKey: string | null
  /** Called with the resolved request URL after the request is sent (browser path only). */
  onRequestSent?: (url: string) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildEffectiveUrl(params: SendRequestParams): string {
  const { url, builderMode, openAPIOperation, openAPIServerUrl, openAPIFormValues } = params

  if (builderMode !== 'openapi' || !openAPIOperation || !openAPIServerUrl) return url

  let fullPath: string = openAPIOperation.path
  if (openAPIFormValues.pathParams) {
    Object.entries(openAPIFormValues.pathParams).forEach(([key, value]) => {
      fullPath = fullPath.replace(`{${key}}`, encodeURIComponent(String(value || '')))
    })
  }

  const queryParts: string[] = []
  if (openAPIFormValues.queryParams) {
    Object.entries(openAPIFormValues.queryParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      if (Array.isArray(value)) {
        value.forEach((v) => queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`))
      } else {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      }
    })
  }

  const base = openAPIServerUrl.replace(/\/$/, '')
  const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
  return `${base}${fullPath}${qs}`
}

function buildHeadersObject(headers: KeyValuePair[]): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.filter((h) => h.enabled && h.key.trim()).forEach((h) => { obj[h.key] = h.value })
  return obj
}

function saveLastRequest(requestUrl: string, params: SendRequestParams) {
  const saved = {
    url: requestUrl,
    method: params.method,
    headers: params.headers,
    queryParams: params.queryParams,
    body: params.body,
    bodyType: params.bodyType,
    rawType: params.rawType,
    formData: params.formData,
    builderMode: params.builderMode,
    openAPIServiceId: params.openAPIServiceId,
    openAPIOperationKey: params.openAPIOperationKey,
    openAPIServerUrl: params.openAPIServerUrl,
    openAPIFormValues: params.openAPIFormValues,
  }
  try {
    localStorage.setItem('apiTester_lastRequest', JSON.stringify(saved))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSendRequest() {
  const dispatch = useAppDispatch()
  const relayJob = useRelayJob()
  const relaySelector = useRelaySelector()

  // Map relay job completion → Redux state
  useEffect(() => {
    if (relayJob.status === 'completed' && relayJob.result) {
      const r = relayJob.result
      dispatch(setRequestResponse({
        status: r.status,
        statusText: r.statusText,
        headers: r.headers,
        body: r.body,
        duration: r.durationMs,
        relayConnectionName: relayJob.connectionName ?? undefined,
        relayDeliveryMode: relayJob.deliveryMode ?? undefined,
      }))
      dispatch(setIsSendingRequest(false))
    } else if (relayJob.status === 'failed' || relayJob.status === 'timed_out') {
      dispatch(setRequestResponse({
        status: 0,
        statusText: relayJob.status === 'timed_out' ? 'Relay Timeout' : 'Relay Error',
        headers: {},
        body: relayJob.error ?? 'An error occurred',
        duration: 0,
        relayConnectionName: relayJob.connectionName ?? undefined,
        relayDeliveryMode: relayJob.deliveryMode ?? undefined,
      }))
      dispatch(setIsSendingRequest(false))
    }
  }, [
    relayJob.status,
    relayJob.result,
    relayJob.error,
    relayJob.connectionName,
    relayJob.deliveryMode,
    dispatch,
  ])

  const sendRequest = useCallback(
    async (params: SendRequestParams) => {
      const requestUrl = buildEffectiveUrl(params)

      if (!requestUrl.trim()) {
        toast.error('Please enter a URL')
        return
      }

      dispatch(setIsSendingRequest(true))

      // ── Relay path ──────────────────────────────────────────────────────
      if (relaySelector.connectionId !== null && relaySelector.connection !== null) {
        const headersObj = buildHeadersObject(params.headers)
        const queryParamsObj: Record<string, string> = {}
        params.queryParams
          .filter((p) => p.enabled && p.key.trim())
          .forEach((p) => { queryParamsObj[p.key] = p.value })

        let bodyStr: string | null = null
        let contentType: string | null = null
        if (['POST', 'PUT', 'PATCH'].includes(params.method)) {
          if (params.bodyType === 'raw') {
            bodyStr = params.body || null
            contentType = headersObj['Content-Type'] ?? null
          } else if (params.bodyType === 'x-www-form-urlencoded') {
            const urlParams = new URLSearchParams()
            params.formData
              .filter((f) => f.enabled && f.key.trim())
              .forEach((f) => urlParams.append(f.key, f.value))
            bodyStr = urlParams.toString()
            contentType = 'application/x-www-form-urlencoded'
          } else if (params.bodyType === 'form-data') {
            const entries: Record<string, string> = {}
            params.formData
              .filter((f) => f.enabled && f.key.trim())
              .forEach((f) => { entries[f.key] = f.value })
            bodyStr = JSON.stringify(entries)
            contentType = 'multipart/form-data'
          }
        }

        relayJob.submit({
          connectionId: relaySelector.connectionId,
          connectionName: relaySelector.connection.name,
          deliveryMode: relaySelector.connection.delivery_mode,
          request: {
            method: params.method,
            url: requestUrl,
            headers: headersObj,
            queryParams: queryParamsObj,
            body: bodyStr,
            contentType,
          },
        })
        return // result handled by the useEffect above
      }

      // ── Browser path ────────────────────────────────────────────────────
      relayJob.reset()
      const startTime = performance.now()

      try {
        const headersObj = buildHeadersObject(params.headers)
        const requestOptions: RequestInit = { method: params.method, headers: headersObj }

        if (['POST', 'PUT', 'PATCH'].includes(params.method)) {
          if (params.bodyType === 'raw') {
            requestOptions.body = params.body
          } else if (params.bodyType === 'form-data') {
            const formDataObj = new FormData()
            params.formData
              .filter((f) => f.enabled && f.key.trim())
              .forEach((f) => formDataObj.append(f.key, f.value))
            requestOptions.body = formDataObj
            delete headersObj['Content-Type']
          } else if (params.bodyType === 'x-www-form-urlencoded') {
            const urlParams = new URLSearchParams()
            params.formData
              .filter((f) => f.enabled && f.key.trim())
              .forEach((f) => urlParams.append(f.key, f.value))
            requestOptions.body = urlParams.toString()
            headersObj['Content-Type'] = 'application/x-www-form-urlencoded'
          }
        }

        const response = await fetch(requestUrl, requestOptions)
        const duration = Math.round(performance.now() - startTime)

        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => { responseHeaders[key] = value })
        const responseBody = await response.text()

        dispatch(setRequestResponse({
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
          duration,
        }))

        params.onRequestSent?.(requestUrl)

        if (response.ok) {
          saveLastRequest(requestUrl, params)
        }
      } catch (error: unknown) {
        const duration = Math.round(performance.now() - startTime)
        dispatch(setRequestResponse({
          status: 0,
          statusText: 'Network Error',
          headers: {},
          body: error instanceof Error ? error.message : 'Failed to send request',
          duration,
        }))
        toast.error('Failed to send request')
      } finally {
        dispatch(setIsSendingRequest(false))
      }
    },
    [relayJob, relaySelector, dispatch],
  )

  return { sendRequest, relaySelector, relayJobStatus: relayJob.status }
}
