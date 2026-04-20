import { MaximizableCodeViewer } from '@/components/api-tester/MaximizableCodeViewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  selectIsSendingRequest,
  selectRequestResponse,
  setRequestResponse,
} from '@/store/apiRequestSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { ArrowLeftRight, FileCode, Minus, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  deliveryModeBadgeLabel,
  extractValidationErrors,
  getResponseSchemaForStatus,
} from './response-utils'
import type { MatchResult } from './types'

interface RequestResponseProps {
  matchResult: MatchResult | null
  relayJobStatus: string
  jsonExpandedToBottom: boolean
  onExpandToBottom: () => void
  onCollapseFromBottom: () => void
  onSendRequest: () => void
}

export function RequestResponse({
  matchResult,
  relayJobStatus,
  jsonExpandedToBottom,
  onExpandToBottom,
  onCollapseFromBottom,
  onSendRequest,
}: RequestResponseProps) {
  const dispatch = useAppDispatch()
  const isSendingRequest = useAppSelector(selectIsSendingRequest)
  const requestResponse = useAppSelector(selectRequestResponse)

  if (isSendingRequest && !requestResponse) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p>{relayJobStatus === 'waiting' ? 'Waiting for relay…' : 'Sending request…'}</p>
      </div>
    )
  }

  if (!requestResponse) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Send a request to see the response</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status ribbon */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge
          variant={
            requestResponse.status >= 200 && requestResponse.status < 300
              ? 'default'
              : 'destructive'
          }
          className={`text-sm px-3 py-1 ${requestResponse.status >= 200 && requestResponse.status < 300 ? 'bg-green-600' : ''}`}
        >
          {requestResponse.status} {requestResponse.statusText}
        </Badge>
        <span className="text-sm text-muted-foreground">{requestResponse.duration}ms</span>
        <span className="text-sm text-muted-foreground">
          {new Blob([requestResponse.body]).size >= 1024
            ? `${(new Blob([requestResponse.body]).size / 1024).toFixed(1)} KB`
            : `${new Blob([requestResponse.body]).size} B`}
        </span>
        {requestResponse.relayConnectionName && (
          <Badge variant="outline" className="text-xs font-normal">
            Via {requestResponse.relayConnectionName}
          </Badge>
        )}
        {requestResponse.relayDeliveryMode && (
          <Badge variant="secondary" className="text-xs font-mono font-normal">
            {deliveryModeBadgeLabel(requestResponse.relayDeliveryMode)}
          </Badge>
        )}
      </div>

      {/* Response Headers */}
      <Collapsible defaultOpen>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCode className="h-4 w-4" />
            Headers
            <Badge variant="secondary" className="text-xs ml-1">
              {Object.keys(requestResponse.headers).length}
            </Badge>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Minus className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="bg-background rounded-lg p-4 border border-border mt-2">
            {Object.keys(requestResponse.headers).length === 0 ? (
              <p className="text-muted-foreground text-sm">No headers returned</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(requestResponse.headers).map(([key, value], index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <td className="px-3 py-2 font-mono text-foreground">{key}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground break-all">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Response Body */}
      {jsonExpandedToBottom ? (
        <div className="bg-background rounded-lg border border-border p-3 flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeftRight className="h-4 w-4 flex-shrink-0" />
          <span>Response body expanded to bottom panel</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 ml-auto"
            onClick={onCollapseFromBottom}
            title="Collapse back to side panel"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <MaximizableCodeViewer
          title="Response Body"
          content={requestResponse.body}
          contentType={
            requestResponse.headers['content-type'] || requestResponse.headers['Content-Type'] || ''
          }
          responseSchema={getResponseSchemaForStatus(matchResult, requestResponse.status)}
          validationErrors={extractValidationErrors(matchResult)}
          onFormat={() => {
            try {
              const parsed = JSON.parse(requestResponse.body)
              const formatted = JSON.stringify(parsed, null, 2)
              dispatch(setRequestResponse({ ...requestResponse, body: formatted }))
              toast.success('Response formatted')
            } catch {
              toast.error('Invalid JSON - cannot format')
            }
          }}
          onExpandToBottom={onExpandToBottom}
          onSendRequest={onSendRequest}
          isSendingRequest={isSendingRequest}
        />
      )}
    </div>
  )
}
