import { useEffect, useMemo, useRef, useState } from 'react'

import {
  setCollapsedSections as setCollapsedSectionsAction,
  setRightPanelTab as setRightPanelTabAction,
} from '@/store/apiTesterSlice'
import { selectIsSendingRequest, selectRequestResponse, setRequestResponse } from '@/store/apiRequestSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { MaximizableCodeViewer } from '@/components/api-tester/MaximizableCodeViewer'
import { OpenAPIFormValues } from '@/components/api-tester/OpenAPIParameterForm'
import {
  BodyType,
  FormDataEntry,
  RawType,
} from '@/components/api-tester/RequestBodyEditor'
import { StandardOperationPanel } from './api-tester/standard/StandardOperationPanel'
import { StandardParamsPanel } from './api-tester/standard/StandardParamsPanel'
import { OpenAPIOperationPanel } from './api-tester/openapi/OpenAPIOperationPanel'
import { OpenAPIParametersPanel } from './api-tester/openapi/OpenAPIParametersPanel'
import { RequestResponseTab } from './api-tester/RequestResponseTab'
import { extractValidationErrors, getResponseSchemaForStatus } from './api-tester/response-utils'
import { useAnalyzeRequest } from './api-tester/useAnalyzeRequest'
import { useOpenAPIFormSync } from './api-tester/useOpenAPIFormSync'
import { useUrlHistory } from './api-tester/useUrlHistory'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useIsMobile } from '@/hooks/use-mobile'
import { useServices } from '@/hooks/useServices'
import { useSendRequest } from '@/hooks/useSendRequest'
import { RelaySelector } from '@/components/api-tester/RelaySelector'
import {
  ArrowLeft,
  FileCode,
  GripHorizontal,
  Send,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { type KeyValuePair } from '@/hooks/useSendRequest'

const ApiTester = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const isSendingRequest = useAppSelector(selectIsSendingRequest)
  const requestResponse = useAppSelector(selectRequestResponse)
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState('GET')
  const [headers, setHeaders] = useState<KeyValuePair[]>([
    { key: 'Content-Type', value: 'application/json', enabled: true },
  ])
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([
    { key: '', value: '', enabled: true },
  ])
  const [body, setBody] = useState('')
  const [bodyType, setBodyType] = useState<BodyType>('raw')
  const [rawType, setRawType] = useState<RawType>('json')
  const [formData, setFormData] = useState<FormDataEntry[]>([{ key: '', value: '', enabled: true }])
  const { data: services = [] } = useServices()

  const [actionMode, setActionMode] = useState<'analyze' | 'request' | 'preview'>('request')
  const setRightPanelTab = (tab: 'match' | 'response' | 'preview') => dispatch(setRightPanelTabAction(tab))

  const { sendRequest, relaySelector, relayJobStatus } = useSendRequest()

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedOperationKey, setSelectedOperationKey] = useState<string | null>(null)
  const [matchMode, setMatchMode] = useState<'auto' | 'manual'>('auto')

  const [builderMode, setBuilderMode] = useState<'standard' | 'openapi'>('openapi')
  const [jsonExpandedToBottom, setJsonExpandedToBottom] = useState(false)
  const [bottomPanelHeight, setBottomPanelHeight] = useState(0)
  const [totalPanelsHeight, setTotalPanelsHeight] = useState(0)
  const panelsWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (jsonExpandedToBottom) {
      requestAnimationFrame(() => {
        if (panelsWrapperRef.current) {
          const top = panelsWrapperRef.current.getBoundingClientRect().top
          const total = window.innerHeight - top
          setTotalPanelsHeight(total)
          setBottomPanelHeight(Math.floor(total * 0.45))
        }
      })
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [jsonExpandedToBottom])

  const handleBottomPanelDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = bottomPanelHeight
    const onMove = (e: MouseEvent) => {
      const delta = startY - e.clientY
      setBottomPanelHeight(Math.max(100, Math.min(totalPanelsHeight - 150, startHeight + delta)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // OpenAPI tab state
  const [openAPIServiceId, setOpenAPIServiceId] = useState<string | null>(null)
  const [openAPIOperationKey, setOpenAPIOperationKey] = useState<string | null>(null)
  const [openAPIOperation, setOpenAPIOperation] = useState<any>(null)
  const [openAPIServerUrl, setOpenAPIServerUrl] = useState<string>('')
  const [, setOpenAPIParsedSpec] = useState<any>(null)
  const [openAPIFormValues, setOpenAPIFormValues] = useState<OpenAPIFormValues>({
    pathParams: {},
    queryParams: {},
    headerParams: {},
    bodyParams: {},
  })

  const [standardParamsTab, setStandardParamsTab] = useState('params')
  const [mobilePanelTab, setMobilePanelTab] = useState<'request' | 'response'>('request')
  const isMobile = useIsMobile()

  const urlValidation = useMemo(() => {
    if (!url.trim()) return { isValid: true, isEmpty: true, message: '' }
    try {
      const parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          isValid: false,
          isEmpty: false,
          message: `Invalid protocol "${parsedUrl.protocol}" - must be http:// or https://`,
        }
      }
      return { isValid: true, isEmpty: false, message: '' }
    } catch {
      if (!url.includes('://')) {
        return {
          isValid: false,
          isEmpty: false,
          message: 'Missing protocol - URL must start with http:// or https://',
        }
      }
      return { isValid: false, isEmpty: false, message: 'Invalid URL format' }
    }
  }, [url])

  const isLocalhostInBrowserMode = useMemo(() => {
    if (relaySelector.connectionId !== null) return false
    try {
      const parsed = new URL(url)
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    } catch {
      return false
    }
  }, [url, relaySelector.connectionId])

  const openAPIValidationResult = useMemo(() => {
    if (builderMode !== 'openapi' || !openAPIOperation) return { hasErrors: false, message: '' }

    const missingParams: string[] = []
    const parameters = openAPIOperation.parameters || []
    for (const param of parameters.filter((p: any) => p.required)) {
      const location =
        param.in === 'path' ? 'pathParams'
        : param.in === 'query' ? 'queryParams'
        : param.in === 'header' ? 'headerParams'
        : 'bodyParams'
      const value = openAPIFormValues[location]?.[param.name]
      if (value === undefined || value === null || value === '') {
        missingParams.push(`${param.name} (${param.in})`)
      }
    }

    if (openAPIOperation.requestBody) {
      const content = openAPIOperation.requestBody.content
      if (content?.['application/json']?.schema) {
        for (const propName of (content['application/json'].schema.required || [])) {
          const value = openAPIFormValues.bodyParams?.[propName]
          if (value === undefined || value === null || value === '') {
            missingParams.push(`${propName} (body)`)
          }
        }
      }
    }

    const hasErrors = missingParams.length > 0
    return { hasErrors, message: hasErrors ? `Missing required: ${missingParams.join(', ')}` : '' }
  }, [builderMode, openAPIOperation, openAPIFormValues])

  const openAPIMissingRequiredParams = openAPIValidationResult.hasErrors

  // ── Hooks ─────────────────────────────────────────────────────────────────

  const { matchResult, isAnalyzing, availableOperations, analyzeRequest } = useAnalyzeRequest({
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
    onClearSelectedOperationKey: () => setSelectedOperationKey(null),
  })

  useOpenAPIFormSync({
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
  })

  // Stable ref breaks the circular dep: useUrlHistory needs onAction, but
  // handleActionButton (onAction) needs addUrlToHistory from useUrlHistory.
  const handleActionRef = useRef<() => Promise<void>>(async () => {})

  const {
    urlHistory,
    urlHistoryIndex,
    setUrlHistoryIndex,
    showUrlHistory,
    setShowUrlHistory,
    urlInputFocusedRef,
    addUrlToHistory,
    handleUrlKeyDown,
  } = useUrlHistory({
    url,
    setUrl,
    isAnalyzing,
    isSendingRequest,
    onAction: () => handleActionRef.current(),
  })

  // ── Validation helpers ─────────────────────────────────────────────────────

  const isQueryParamDuplicate = (index: number, key: string): boolean => {
    if (!key.trim()) return false
    const lowerKey = key.toLowerCase()
    return queryParams.some((p, i) => i !== index && p.enabled && p.key.toLowerCase() === lowerKey)
  }

  const isHeaderDuplicate = (index: number, key: string): boolean => {
    if (!key.trim()) return false
    const lowerKey = key.toLowerCase()
    return headers.some((h, i) => i !== index && h.enabled && h.key.toLowerCase() === lowerKey)
  }

  const getQueryParamValidationStatus = (
    paramKey: string,
  ): { isValid: boolean; isUnspecified: boolean } | null => {
    if (!matchResult?.operation || !paramKey.trim()) return null
    const param = matchResult.operation.queryParameters.find(
      (p) => p.name.toLowerCase() === paramKey.toLowerCase(),
    )
    return param ? { isValid: param.isValid, isUnspecified: param.isUnspecified } : null
  }

  const getHeaderValidationStatus = (
    headerKey: string,
  ): { isValid: boolean; isUnspecified: boolean } | null => {
    if (!matchResult?.operation || !headerKey.trim()) return null
    const param = matchResult.operation.headerParameters.find(
      (p) => p.name.toLowerCase() === headerKey.toLowerCase(),
    )
    return param ? { isValid: param.isValid, isUnspecified: param.isUnspecified } : null
  }

  const getValidationBorderClass = (
    status: { isValid: boolean; isUnspecified: boolean } | null,
    isDuplicate: boolean,
  ): string => {
    if (isDuplicate) return 'border-destructive focus-visible:ring-destructive'
    if (!status) return ''
    if (!status.isValid) return 'border-destructive focus-visible:ring-destructive'
    if (status.isUnspecified) return 'border-orange-500 focus-visible:ring-orange-500'
    return 'border-green-500 focus-visible:ring-green-500'
  }

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (relaySelector.deletedWarning) {
      toast.warning('Your previously selected relay connection was deleted. Switched to Browser (direct).')
      relaySelector.clearDeletedWarning()
    }
  }, [relaySelector.deletedWarning])

  useEffect(() => {
    const savedState = localStorage.getItem('apiTester_lastRequest')
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        if (parsed.url) setUrl(parsed.url)
        if (parsed.method) setMethod(parsed.method)
        if (parsed.headers) setHeaders(parsed.headers)
        if (parsed.queryParams) setQueryParams(parsed.queryParams)
        if (parsed.body !== undefined) setBody(parsed.body)
        if (parsed.bodyType) setBodyType(parsed.bodyType)
        if (parsed.rawType) setRawType(parsed.rawType)
        if (parsed.formData) setFormData(parsed.formData)
        if (parsed.builderMode) setBuilderMode(parsed.builderMode)
        if (parsed.openAPIServiceId) setOpenAPIServiceId(parsed.openAPIServiceId)
        if (parsed.openAPIOperationKey) setOpenAPIOperationKey(parsed.openAPIOperationKey)
        if (parsed.openAPIServerUrl) setOpenAPIServerUrl(parsed.openAPIServerUrl)
        if (parsed.openAPIFormValues) setOpenAPIFormValues(parsed.openAPIFormValues)
      } catch (e) {
        console.error('Failed to restore saved request state:', e)
      }
    }
  }, [])

  // Sync query params to URL
  useEffect(() => {
    if (isUrlDrivenParamUpdateRef.current) {
      isUrlDrivenParamUpdateRef.current = false
      return
    }
    if (!url) return
    try {
      const urlObj = new URL(url)
      const enabledParams = queryParams.filter((p) => p.enabled && p.key.trim())
      const newSearchParams = new URLSearchParams()
      enabledParams.forEach((p) => { newSearchParams.append(p.key, p.value) })
      const newSearch = newSearchParams.toString()
      const currentSearch = urlObj.search.replace(/^\?/, '')
      if (newSearch !== currentSearch) {
        const baseUrl = url.split('?')[0]
        const newUrl = newSearch ? `${baseUrl}?${newSearch}` : baseUrl
        if (newUrl !== url) setUrl(newUrl)
      }
    } catch {
      // Invalid URL, ignore
    }
  }, [queryParams])

  // Sync service/operation selection between OpenAPI and Standard modes
  useEffect(() => {
    if (builderMode === 'openapi') {
      if (selectedServiceId && !openAPIServiceId) setOpenAPIServiceId(selectedServiceId)
      if (selectedOperationKey && !openAPIOperationKey) setOpenAPIOperationKey(selectedOperationKey)
      if (openAPIServiceId !== selectedServiceId) setSelectedServiceId(openAPIServiceId)
      if (openAPIOperationKey !== selectedOperationKey) setSelectedOperationKey(openAPIOperationKey)
      dispatch(setCollapsedSectionsAction({ apiMatch: true, service: true, server: true, operation: true }))
    } else {
      if (openAPIServiceId && !selectedServiceId) setSelectedServiceId(openAPIServiceId)
      if (openAPIOperationKey && !selectedOperationKey) setSelectedOperationKey(openAPIOperationKey)
      if (selectedServiceId !== openAPIServiceId) setOpenAPIServiceId(selectedServiceId)
      if (selectedOperationKey !== openAPIOperationKey) setOpenAPIOperationKey(selectedOperationKey)
      dispatch(setCollapsedSectionsAction({ apiMatch: false, service: false, server: false, operation: false }))
    }
  }, [builderMode, openAPIServiceId, openAPIOperationKey, selectedServiceId, selectedOperationKey])

  const isUrlDrivenParamUpdateRef = useRef(false)
  const cmdEnterHandlerRef = useRef<() => void>(() => {})
  useEffect(() => {
    cmdEnterHandlerRef.current = () => {
      if (!isAnalyzing && !isSendingRequest) {
        addUrlToHistory(url)
        handleActionRef.current()
      }
    }
  })
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        cmdEnterHandlerRef.current()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const addHeader = () => setHeaders([...headers, { key: '', value: '', enabled: true }])
  const removeHeader = (index: number) => setHeaders(headers.filter((_, i) => i !== index))
  const updateHeader = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const updated = [...headers]
    updated[index] = { ...updated[index], [field]: value }
    setHeaders(updated)
  }

  const addQueryParam = () => setQueryParams([...queryParams, { key: '', value: '', enabled: true }])
  const removeQueryParam = (index: number) => setQueryParams(queryParams.filter((_, i) => i !== index))
  const updateQueryParam = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const updated = [...queryParams]
    updated[index] = { ...updated[index], [field]: value }
    setQueryParams(updated)
  }

  const handleActionButton = async () => {
    if (actionMode === 'request' && openAPIValidationResult.hasErrors) {
      toast.error(openAPIValidationResult.message)
    }

    if (matchMode === 'auto' && selectedServiceId && selectedOperationKey) {
      setMatchMode('manual')
    }

    if (actionMode === 'analyze') {
      await analyzeRequest()
      setRightPanelTab('match')
      if (isMobile) setMobilePanelTab('response')
    } else if (actionMode === 'preview') {
      setRightPanelTab('preview')
      if (isMobile) setMobilePanelTab('response')
    } else {
      await analyzeRequest()
      setRightPanelTab('response')
      sendRequest({
        url,
        method,
        headers,
        queryParams,
        body,
        bodyType,
        rawType,
        formData,
        builderMode,
        openAPIOperation,
        openAPIServerUrl,
        openAPIFormValues,
        openAPIServiceId,
        openAPIOperationKey,
        onRequestSent: addUrlToHistory,
      })
      if (isMobile) setMobilePanelTab('response')
    }
  }
  // Keep ref current so useUrlHistory and cmdEnterHandlerRef can call it
  handleActionRef.current = handleActionButton

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    try {
      const urlObj = new URL(newUrl)
      const params: KeyValuePair[] = []
      urlObj.searchParams.forEach((value, key) => {
        params.push({ key, value, enabled: true })
      })
      params.push({ key: '', value: '', enabled: true })
      isUrlDrivenParamUpdateRef.current = true
      setQueryParams(params)
    } catch {
      // Invalid URL, ignore
    }
  }

  const buildRequestPreview = () => {
    let baseUrl = url
    if (builderMode === 'openapi' && openAPIOperation && openAPIServerUrl) {
      let fullPath = openAPIOperation.path
      if (openAPIFormValues.pathParams) {
        Object.entries(openAPIFormValues.pathParams).forEach(([key, value]) => {
          fullPath = fullPath.replace(`{${key}}`, encodeURIComponent(String(value || `{${key}}`)))
        })
      }
      baseUrl = `${openAPIServerUrl.replace(/\/$/, '')}${fullPath}`
    }

    let fullUrl = baseUrl
    const enabledParams = queryParams.filter((p) => p.enabled && p.key.trim())
    if (enabledParams.length > 0) {
      const searchParams = new URLSearchParams()
      enabledParams.forEach((p) => searchParams.append(p.key, p.value))
      fullUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${searchParams.toString()}`
    }

    const previewHeaders: Record<string, string> = {}
    headers.filter((h) => h.enabled && h.key.trim()).forEach((h) => {
      previewHeaders[h.key] = h.value
    })

    let bodyContent = ''
    if (method !== 'GET' && method !== 'HEAD') {
      if (bodyType === 'raw') {
        bodyContent = body
        if (!previewHeaders['Content-Type']) {
          previewHeaders['Content-Type'] =
            rawType === 'json' ? 'application/json'
            : rawType === 'xml' ? 'application/xml'
            : 'text/plain'
        }
      } else if (bodyType === 'form-data') {
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
        if (!previewHeaders['Content-Type']) {
          previewHeaders['Content-Type'] = `multipart/form-data; boundary=${boundary}`
        }
        const parts = formData
          .filter((f) => f.enabled && f.key.trim())
          .map((f) => `--${boundary}\r\nContent-Disposition: form-data; name="${f.key}"\r\n\r\n${f.value}\r\n`)
        bodyContent = parts.join('') + `--${boundary}--`
      } else if (bodyType === 'x-www-form-urlencoded') {
        if (!previewHeaders['Content-Type']) {
          previewHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
        }
        const formParams = new URLSearchParams()
        formData.filter((f) => f.enabled && f.key.trim()).forEach((f) => formParams.append(f.key, f.value))
        bodyContent = formParams.toString()
      } else if (bodyType === 'binary') {
        bodyContent = '[Binary content]'
        if (!previewHeaders['Content-Type']) previewHeaders['Content-Type'] = 'application/octet-stream'
      }
    }

    if (bodyContent && bodyType !== 'form-data') {
      previewHeaders['Content-Length'] = String(new TextEncoder().encode(bodyContent).length)
    }

    return { fullUrl, previewHeaders, bodyContent }
  }

  // ── JSX ────────────────────────────────────────────────────────────────────

  const builderPanel = (
    <>
      {builderMode === 'standard' ? (
        <>
          <StandardOperationPanel
            method={method}
            onMethodChange={setMethod}
            url={url}
            onUrlChange={handleUrlChange}
            urlValidation={urlValidation}
            urlHistory={urlHistory}
            urlHistoryIndex={urlHistoryIndex}
            onUrlHistoryIndexChange={setUrlHistoryIndex}
            showUrlHistory={showUrlHistory}
            onShowUrlHistoryChange={setShowUrlHistory}
            urlInputFocusedRef={urlInputFocusedRef}
            onUrlKeyDown={handleUrlKeyDown}
            actionMode={actionMode}
            onActionModeChange={setActionMode}
            isAnalyzing={isAnalyzing}
            isSendingRequest={isSendingRequest}
            onAction={handleActionButton}
            onRightPanelTabChange={setRightPanelTab}
            isLocalhostInBrowserMode={isLocalhostInBrowserMode}
            relayConnections={relaySelector.connections}
            onSelectRelay={relaySelector.setConnectionId}
          />
          <StandardParamsPanel
            activeTab={standardParamsTab}
            onActiveTabChange={setStandardParamsTab}
            queryParams={queryParams}
            onAddQueryParam={addQueryParam}
            onRemoveQueryParam={removeQueryParam}
            onUpdateQueryParam={updateQueryParam}
            headers={headers}
            onAddHeader={addHeader}
            onRemoveHeader={removeHeader}
            onUpdateHeader={updateHeader}
            body={body}
            onBodyChange={setBody}
            bodyType={bodyType}
            onBodyTypeChange={setBodyType}
            rawType={rawType}
            onRawTypeChange={setRawType}
            formData={formData}
            onFormDataChange={setFormData}
            getQueryParamValidationStatus={getQueryParamValidationStatus}
            getHeaderValidationStatus={getHeaderValidationStatus}
            getValidationBorderClass={getValidationBorderClass}
            isQueryParamDuplicate={isQueryParamDuplicate}
            isHeaderDuplicate={isHeaderDuplicate}
          />
        </>
      ) : (
        <div className="space-y-4">
          <OpenAPIOperationPanel
            openAPIOperation={openAPIOperation}
            openAPIServerUrl={openAPIServerUrl}
            openAPIServiceId={openAPIServiceId}
            openAPIOperationKey={openAPIOperationKey}
            openAPIFormValues={openAPIFormValues}
            actionMode={actionMode}
            onActionModeChange={setActionMode}
            isAnalyzing={isAnalyzing}
            isSendingRequest={isSendingRequest}
            openAPIMissingRequiredParams={openAPIMissingRequiredParams}
            onAction={handleActionButton}
            onRightPanelTabChange={setRightPanelTab}
            isLocalhostInBrowserMode={isLocalhostInBrowserMode}
            relayConnections={relaySelector.connections}
            onSelectRelay={relaySelector.setConnectionId}
          />
          <OpenAPIParametersPanel
            services={services}
            openAPIServiceId={openAPIServiceId}
            openAPIOperationKey={openAPIOperationKey}
            openAPIServerUrl={openAPIServerUrl}
            openAPIFormValues={openAPIFormValues}
            onOpenAPIServiceIdChange={setOpenAPIServiceId}
            onOpenAPIOperationKeyChange={setOpenAPIOperationKey}
            onOpenAPIServerUrlChange={setOpenAPIServerUrl}
            onOpenAPIFormValuesChange={setOpenAPIFormValues}
            onOpenAPIOperationParsed={setOpenAPIOperation}
            onOpenAPISpecParsed={setOpenAPIParsedSpec}
          />
        </div>
      )}
    </>
  )

  const requestResponseTab = (
    <RequestResponseTab
      matchResult={matchResult}
      relayJobStatus={relayJobStatus}
      jsonExpandedToBottom={jsonExpandedToBottom}
      onExpandToBottom={() => setJsonExpandedToBottom(true)}
      onCollapseFromBottom={() => setJsonExpandedToBottom(false)}
      onSendRequest={handleActionButton}
      buildRequestPreview={buildRequestPreview}
      method={method}
      builderMode={builderMode}
      matchMode={matchMode}
      onMatchModeChange={setMatchMode}
      selectedServiceId={selectedServiceId}
      onSelectedServiceIdChange={setSelectedServiceId}
      selectedOperationKey={selectedOperationKey}
      onSelectedOperationKeyChange={setSelectedOperationKey}
      services={services}
      availableOperations={availableOperations}
    />
  )

  const builderModeToggle = (
    <ToggleGroup
      type="single"
      value={builderMode}
      onValueChange={(value) => value && setBuilderMode(value as 'standard' | 'openapi')}
      className="bg-muted rounded-md p-1"
    >
      <ToggleGroupItem
        value="standard"
        className="px-3 py-1 text-sm text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
      >
        Standard
      </ToggleGroupItem>
      <ToggleGroupItem
        value="openapi"
        className="px-3 py-1 text-sm text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
      >
        OpenAPI
      </ToggleGroupItem>
    </ToggleGroup>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/30 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">API Request Tester</h1>
                <p className="text-sm text-muted-foreground">
                  Test requests against your OpenAPI specifications
                </p>
              </div>
            </div>
            <RelaySelector
              connectionId={relaySelector.connectionId}
              connections={relaySelector.connections}
              isLoading={relaySelector.isLoading}
              onSelect={relaySelector.setConnectionId}
            />
          </div>
        </div>
      </header>

      <main className="max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isMobile ? (
          <Tabs
            value={mobilePanelTab}
            onValueChange={(v) => setMobilePanelTab(v as 'request' | 'response')}
            className="w-full"
          >
            <TabsList className="w-full mb-4">
              <TabsTrigger value="request" className="flex-1">
                <Send className="h-4 w-4 mr-2" />
                Request
              </TabsTrigger>
              <TabsTrigger value="response" className="flex-1">
                <FileCode className="h-4 w-4 mr-2" />
                Response
              </TabsTrigger>
            </TabsList>

            <TabsContent value="request" className="mt-0">
              <Card className="border border-border bg-card/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Send className="h-5 w-5 text-primary" />
                      Request Builder
                    </CardTitle>
                    {builderModeToggle}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {builderPanel}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="response" className="mt-0">
              {requestResponseTab}
            </TabsContent>
          </Tabs>
        ) : (
          <div ref={panelsWrapperRef} className="relative" style={jsonExpandedToBottom ? { height: totalPanelsHeight, overflow: 'hidden' } : {}}>
            <ResizablePanelGroup
              direction="horizontal"
              className="rounded-lg"
              style={jsonExpandedToBottom ? { height: totalPanelsHeight - bottomPanelHeight } : { minHeight: '80vh' }}
            >
              <ResizablePanel defaultSize={45} minSize={30}>
                <Card className="border-0 bg-card/50 h-full rounded-none">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Send className="h-5 w-5 text-primary" />
                        Request Builder
                      </CardTitle>
                      {builderModeToggle}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 overflow-y-auto">
                    {builderPanel}
                  </CardContent>
                </Card>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={55} minSize={30}>
                {requestResponseTab}
              </ResizablePanel>
            </ResizablePanelGroup>

            {jsonExpandedToBottom && requestResponse && (
              <>
                <div
                  className="flex items-center justify-center h-3 cursor-row-resize bg-border/50 hover:bg-border select-none"
                  onMouseDown={handleBottomPanelDragStart}
                >
                  <GripHorizontal className="h-3 w-3 text-muted-foreground" />
                </div>
                <div style={{ height: bottomPanelHeight }} className="overflow-hidden">
                  <MaximizableCodeViewer
                    title="Response Body"
                    content={requestResponse.body}
                    contentType={
                      requestResponse.headers['content-type'] ||
                      requestResponse.headers['Content-Type'] ||
                      ''
                    }
                    responseSchema={getResponseSchemaForStatus(matchResult, requestResponse.status)}
                    validationErrors={extractValidationErrors(matchResult)}
                    onFormat={() => {
                      try {
                        const parsed = JSON.parse(requestResponse.body)
                        dispatch(setRequestResponse({ ...requestResponse, body: JSON.stringify(parsed, null, 2) }))
                        toast.success('Response formatted')
                      } catch {
                        toast.error('Invalid JSON - cannot format')
                      }
                    }}
                    onCollapseFromBottom={() => setJsonExpandedToBottom(false)}
                    onSendRequest={handleActionButton}
                    isSendingRequest={isSendingRequest}
                    maxHeight="none"
                    className="h-full rounded-none border-x-0 border-b-0"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default ApiTester
