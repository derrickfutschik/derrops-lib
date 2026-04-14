import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertCircle, ChevronDown, Eye, Search, Send } from 'lucide-react'
import type { OpenAPIFormValues } from '@/components/api-tester/OpenAPIParameterForm'
import { ActionMode } from '../types'

interface OpenAPIOperationPanelProps {
  openAPIOperation: any | null
  openAPIServiceId: string | null
  openAPIOperationKey: string | null
  openAPIFormValues: OpenAPIFormValues
  openAPIServerUrl: string
  actionMode: ActionMode
  onActionModeChange: (mode: ActionMode) => void
  isAnalyzing: boolean
  isSendingRequest: boolean
  openAPIMissingRequiredParams: boolean
  onAction: () => void
  onRightPanelTabChange: (tab: 'match' | 'response' | 'preview') => void
  isLocalhostInBrowserMode: boolean
  relayConnections: Array<{ id: string; type: string }>
  onSelectRelay: (id: string | null) => void
}

function methodColorClass(m: string) {
  return m === 'GET'
    ? 'text-green-500'
    : m === 'POST'
      ? 'text-yellow-500'
      : m === 'PUT'
        ? 'text-blue-500'
        : m === 'PATCH'
          ? 'text-purple-500'
          : m === 'DELETE'
            ? 'text-red-500'
            : 'text-muted-foreground'
}

function buildDisplayUrl(
  openAPIOperation: any | null,
  openAPIServerUrl: string,
  openAPIFormValues: OpenAPIFormValues,
): string {
  if (!openAPIOperation || !openAPIServerUrl) return ''

  let fullPath: string = openAPIOperation.path
  if (openAPIFormValues.pathParams) {
    Object.entries(openAPIFormValues.pathParams).forEach(([key, value]) => {
      fullPath = fullPath.replace(`{${key}}`, String(value || `{${key}}`))
    })
  }

  const queryParts: string[] = []
  if (openAPIFormValues.queryParams) {
    Object.entries(openAPIFormValues.queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      }
    })
  }

  const baseUrl = openAPIServerUrl.replace(/\/$/, '')
  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
  return `${baseUrl}${fullPath}${queryString}`
}

export function OpenAPIOperationPanel({
  openAPIOperation,
  openAPIServiceId,
  openAPIOperationKey,
  openAPIFormValues,
  openAPIServerUrl,
  actionMode,
  onActionModeChange,
  isAnalyzing,
  isSendingRequest,
  openAPIMissingRequiredParams,
  onAction,
  onRightPanelTabChange,
  isLocalhostInBrowserMode,
  relayConnections,
  onSelectRelay,
}: OpenAPIOperationPanelProps) {
  const isActionDisabled =
    isAnalyzing || isSendingRequest || !openAPIServiceId || !openAPIOperationKey
  const isRequestOpaque = actionMode === 'request' && openAPIMissingRequiredParams
  const displayUrl = buildDisplayUrl(openAPIOperation, openAPIServerUrl, openAPIFormValues)
  const urlPlaceholder = !openAPIServiceId
    ? 'Select an API Service to build the request URL'
    : 'Select an operation to build the request URL'

  const ActionButton = ({ size }: { size: 'sm' | 'lg' }) => (
    <div className="flex">
      <Button
        onClick={onAction}
        disabled={isActionDisabled}
        className={`rounded-r-none border-r-0 relative min-w-[110px] ${isRequestOpaque ? 'opacity-50' : ''}`}
      >
        <span className={isAnalyzing || isSendingRequest ? 'invisible' : ''}>
          {actionMode === 'analyze' ? (
            <Search className="h-4 w-4 mr-2 inline" />
          ) : actionMode === 'preview' ? (
            <Eye className="h-4 w-4 mr-2 inline" />
          ) : (
            <Send className="h-4 w-4 mr-2 inline" />
          )}
          {actionMode === 'analyze' ? 'Match' : actionMode === 'preview' ? 'Preview' : 'Request'}
        </span>
        {(isAnalyzing || isSendingRequest) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
          </div>
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            className={`rounded-l-none px-2 ${isRequestOpaque ? 'opacity-50' : ''}`}
            disabled={isActionDisabled}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover z-50">
          <DropdownMenuItem
            onClick={() => { onActionModeChange('analyze'); onRightPanelTabChange('match') }}
            className={actionMode === 'analyze' ? 'bg-accent' : ''}
          >
            <Search className="h-4 w-4 mr-2" />
            Match
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => { onActionModeChange('request'); onRightPanelTabChange('response') }}
            className={actionMode === 'request' ? 'bg-accent' : ''}
          >
            <Send className="h-4 w-4 mr-2" />
            Request
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => { onActionModeChange('preview'); onRightPanelTabChange('preview') }}
            className={actionMode === 'preview' ? 'bg-accent' : ''}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const MethodBadge = ({ className = '' }: { className?: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Select value={openAPIOperation?.method || ''} disabled>
            <SelectTrigger
              className={`bg-background opacity-70 cursor-not-allowed ${className}`}
            >
              <SelectValue placeholder="Method">
                {openAPIOperation?.method ? (
                  <span className={methodColorClass(openAPIOperation.method)}>
                    {openAPIOperation.method}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Method</span>
                )}
              </SelectValue>
            </SelectTrigger>
          </Select>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>Select an operation below to set the method</p>
      </TooltipContent>
    </Tooltip>
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Mobile/narrow layout */}
      <div className="flex gap-2 items-center justify-between xl:hidden">
        <MethodBadge className="w-[100px]" />
        <ActionButton size="sm" />
      </div>

      <Input
        placeholder={urlPlaceholder}
        value={displayUrl}
        readOnly
        disabled={!openAPIServiceId}
        className="bg-background xl:hidden"
      />

      {/* Desktop xl+ layout: all on one row */}
      <div className="hidden xl:flex gap-2">
        <MethodBadge className="w-[120px]" />
        <Input
          placeholder={urlPlaceholder}
          value={displayUrl}
          readOnly
          disabled={!openAPIServiceId}
          className="flex-1 bg-background"
        />
        <ActionButton size="lg" />
      </div>

      {isLocalhostInBrowserMode && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>Localhost target detected.</strong> Browser mode cannot reach local services on another machine. Start a local relay or{' '}
            <button
              className="underline underline-offset-2 hover:no-underline"
              onClick={() => onSelectRelay(
                relayConnections.find((c) => c.type === 'local-dev')?.id ?? null
              )}
            >
              switch to a local relay connection
            </button>
            {relayConnections.filter((c) => c.type === 'local-dev').length === 0 && (
              <> — <a href="/connections" className="underline underline-offset-2 hover:no-underline">set one up</a></>
            )}.
          </span>
        </div>
      )}
    </div>
  )
}
