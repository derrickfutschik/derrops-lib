import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, FileCode, Send } from 'lucide-react'
import { selectRightPanelTab, setRightPanelTab as setRightPanelTabAction } from '@/store/apiTesterSlice'
import { selectRequestResponse } from '@/store/apiRequestSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { Service } from '@/client/slaops-cloud/models/service'
import type { BuilderMode, MatchResult, OperationOption } from './types'
import { OpenAPIMatchResponse } from './OpenAPIMatchResponse'
import { RequestResponse } from './RequestResponse'
import { PreviewRequest } from './PreviewRequest'
import { MatchModeSelectorPanel } from './MatchModeSelectorPanel'

interface RequestResponseTabProps {
  matchResult: MatchResult | null
  relayJobStatus: string
  jsonExpandedToBottom: boolean
  onExpandToBottom: () => void
  onCollapseFromBottom: () => void
  onSendRequest: () => void
  buildRequestPreview: () => {
    fullUrl: string
    previewHeaders: Record<string, string>
    bodyContent: string
  }
  method: string
  builderMode: BuilderMode
  matchMode: 'auto' | 'manual'
  onMatchModeChange: (mode: 'auto' | 'manual') => void
  selectedServiceId: string | null
  onSelectedServiceIdChange: (id: string | null) => void
  selectedOperationKey: string | null
  onSelectedOperationKeyChange: (key: string | null) => void
  services: Service[]
  availableOperations: OperationOption[]
}

function MatchTabLabel({ matchResult }: { matchResult: MatchResult | null }) {
  if (!matchResult) return <><FileCode className="h-4 w-4" /><span>Match</span></>

  const errorCount = matchResult.validationErrors?.length || 0
  const warningCount = matchResult.validationWarnings?.length || 0
  const invalidCount = matchResult.operation
    ? [
        ...(matchResult.operation.pathParameters || []),
        ...(matchResult.operation.queryParameters || []),
        ...(matchResult.operation.headerParameters || []),
        ...(matchResult.operation.bodyProperties || []),
      ].filter((p) => !p.isValid).length
    : 0

  if (errorCount > 0 || invalidCount > 0) {
    return (
      <span className="flex items-center gap-2 text-destructive">
        <FileCode className="h-4 w-4" />
        <span>Match</span>
        <Badge variant="destructive" className="ml-1 text-xs">
          {errorCount + invalidCount}
        </Badge>
      </span>
    )
  } else if (warningCount > 0) {
    return (
      <span className="flex items-center gap-2 text-orange-500">
        <FileCode className="h-4 w-4" />
        <span>Match</span>
        <Badge className="ml-1 text-xs bg-orange-500 hover:bg-orange-600">{warningCount}</Badge>
      </span>
    )
  } else {
    return (
      <span className="flex items-center gap-2 text-green-500">
        <FileCode className="h-4 w-4" />
        <span>Match</span>
      </span>
    )
  }
}

export function RequestResponseTab({
  matchResult,
  relayJobStatus,
  jsonExpandedToBottom,
  onExpandToBottom,
  onCollapseFromBottom,
  onSendRequest,
  buildRequestPreview,
  method,
  builderMode,
  matchMode,
  onMatchModeChange,
  selectedServiceId,
  onSelectedServiceIdChange,
  selectedOperationKey,
  onSelectedOperationKeyChange,
  services,
  availableOperations,
}: RequestResponseTabProps) {
  const dispatch = useAppDispatch()
  const rightPanelTab = useAppSelector(selectRightPanelTab)
  const requestResponse = useAppSelector(selectRequestResponse)
  const setRightPanelTab = (tab: 'match' | 'response' | 'preview') =>
    dispatch(setRightPanelTabAction(tab))

  return (
    <Card className="border-0 bg-card/50 h-full rounded-none overflow-auto">
      <CardHeader className="pb-4">
        <Tabs
          value={rightPanelTab}
          onValueChange={(v) => setRightPanelTab(v as 'match' | 'response' | 'preview')}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-2 mb-4"
            style={{ containerType: 'inline-size' }}
          >
            {/* Narrow container: Select dropdown */}
            <div className="@[400px]:hidden w-full flex items-center gap-2">
              <Select
                value={rightPanelTab}
                onValueChange={(v) => setRightPanelTab(v as 'match' | 'response' | 'preview')}
              >
                <SelectTrigger className="flex-1 bg-muted/50">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      {rightPanelTab === 'match' && <MatchTabLabel matchResult={matchResult} />}
                      {rightPanelTab === 'response' && (
                        <>
                          <Send className="h-4 w-4" />
                          Response
                          {requestResponse && (
                            <Badge
                              variant={
                                requestResponse.status >= 200 && requestResponse.status < 300
                                  ? 'default'
                                  : 'destructive'
                              }
                              className={`ml-1 text-xs ${requestResponse.status >= 200 && requestResponse.status < 300 ? 'bg-green-600 hover:bg-green-700' : ''}`}
                            >
                              {requestResponse.status}
                            </Badge>
                          )}
                        </>
                      )}
                      {rightPanelTab === 'preview' && (
                        <>
                          <Eye className="h-4 w-4" />
                          Preview
                        </>
                      )}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match">
                    <MatchTabLabel matchResult={matchResult} />
                  </SelectItem>
                  <SelectItem value="response">
                    <span className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Response
                      {requestResponse && (
                        <Badge
                          variant={
                            requestResponse.status >= 200 && requestResponse.status < 300
                              ? 'default'
                              : 'destructive'
                          }
                          className={`ml-1 text-xs ${requestResponse.status >= 200 && requestResponse.status < 300 ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        >
                          {requestResponse.status}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                  <SelectItem value="preview">
                    <span className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Wide container: Tabs */}
            <TabsList className="bg-muted/50 hidden @[400px]:grid grid-cols-3 w-full">
              <TabsTrigger
                value="match"
                className="w-full flex items-center justify-between gap-2"
              >
                {matchResult ? (
                  (() => {
                    const errorCount = matchResult.validationErrors?.length || 0
                    const warningCount = matchResult.validationWarnings?.length || 0
                    const invalidCount = matchResult.operation
                      ? [
                          ...(matchResult.operation.pathParameters || []),
                          ...(matchResult.operation.queryParameters || []),
                          ...(matchResult.operation.headerParameters || []),
                          ...(matchResult.operation.bodyProperties || []),
                        ].filter((p) => !p.isValid).length
                      : 0

                    if (errorCount > 0 || invalidCount > 0) {
                      return (
                        <>
                          <span className="flex items-center gap-2 text-destructive">
                            <FileCode className="h-4 w-4 shrink-0" />
                            <span>Match</span>
                          </span>
                          <Badge variant="destructive" className="ml-auto text-xs">
                            {errorCount + invalidCount} invalid
                          </Badge>
                        </>
                      )
                    } else if (warningCount > 0) {
                      return (
                        <>
                          <span className="flex items-center gap-2 text-orange-500">
                            <FileCode className="h-4 w-4 shrink-0" />
                            <span>Match</span>
                          </span>
                          <Badge className="ml-auto text-xs bg-orange-500 hover:bg-orange-600">
                            {warningCount} warning{warningCount > 1 ? 's' : ''}
                          </Badge>
                        </>
                      )
                    } else {
                      return (
                        <span className="flex items-center gap-2 text-green-500">
                          <FileCode className="h-4 w-4 shrink-0" />
                          <span>Match</span>
                        </span>
                      )
                    }
                  })()
                ) : (
                  <span className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 shrink-0" />
                    <span>Match</span>
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="response"
                className="w-full flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4 shrink-0" />
                  <span>Response</span>
                </span>
                {requestResponse && (
                  <Badge
                    variant={
                      requestResponse.status >= 200 && requestResponse.status < 300
                        ? 'default'
                        : 'destructive'
                    }
                    className={`ml-auto text-xs ${requestResponse.status >= 200 && requestResponse.status < 300 ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  >
                    {requestResponse.status}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="w-full flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4 shrink-0" />
                  <span>Preview</span>
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Match tab header content: API Match section (Standard mode only) */}
          <TabsContent value="match" className="mt-0">
            {builderMode === 'standard' && (
              <MatchModeSelectorPanel
                matchMode={matchMode}
                onMatchModeChange={onMatchModeChange}
                selectedServiceId={selectedServiceId}
                onSelectedServiceIdChange={onSelectedServiceIdChange}
                selectedOperationKey={selectedOperationKey}
                onSelectedOperationKeyChange={onSelectedOperationKeyChange}
                services={services}
                availableOperations={availableOperations}
              />
            )}
          </TabsContent>

          {/* Response tab header content: duration/size summary */}
          <TabsContent value="response" className="mt-0">
            {requestResponse && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{requestResponse.duration}ms</span>
                <span className="text-muted-foreground">
                  {new Blob([requestResponse.body]).size >= 1024
                    ? `${(new Blob([requestResponse.body]).size / 1024).toFixed(1)} KB`
                    : `${new Blob([requestResponse.body]).size} B`}
                </span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardHeader>

      <CardContent>
        {rightPanelTab === 'match' ? (
          <OpenAPIMatchResponse matchResult={matchResult} />
        ) : rightPanelTab === 'response' ? (
          <RequestResponse
            matchResult={matchResult}
            relayJobStatus={relayJobStatus}
            jsonExpandedToBottom={jsonExpandedToBottom}
            onExpandToBottom={onExpandToBottom}
            onCollapseFromBottom={onCollapseFromBottom}
            onSendRequest={onSendRequest}
          />
        ) : (
          <PreviewRequest method={method} buildRequestPreview={buildRequestPreview} />
        )}
      </CardContent>
    </Card>
  )
}
