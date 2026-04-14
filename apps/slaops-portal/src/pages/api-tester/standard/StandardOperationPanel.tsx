import { useRef } from 'react'
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
import { HTTP_METHODS, ActionMode } from '../types'

interface StandardOperationPanelProps {
  method: string
  onMethodChange: (method: string) => void
  url: string
  onUrlChange: (url: string) => void
  urlValidation: { isValid: boolean; isEmpty: boolean; message: string }
  urlHistory: string[]
  urlHistoryIndex: number
  onUrlHistoryIndexChange: (i: number) => void
  showUrlHistory: boolean
  onShowUrlHistoryChange: (show: boolean) => void
  urlInputFocusedRef: React.MutableRefObject<boolean>
  onUrlKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  actionMode: ActionMode
  onActionModeChange: (mode: ActionMode) => void
  isAnalyzing: boolean
  isSendingRequest: boolean
  onAction: () => void
  onRightPanelTabChange: (tab: 'match' | 'response' | 'preview') => void
  isLocalhostInBrowserMode: boolean
  relayConnections: Array<{ id: string; type: string }>
  onSelectRelay: (id: string | null) => void
}

const methodColorClass = (m: string) =>
  m === 'GET'
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

const ActionButton = ({
  actionMode,
  isAnalyzing,
  isSendingRequest,
  onAction,
  onActionModeChange,
  onRightPanelTabChange,
  buttonClassName = '',
  dropdownClassName = '',
}: {
  actionMode: ActionMode
  isAnalyzing: boolean
  isSendingRequest: boolean
  onAction: () => void
  onActionModeChange: (mode: ActionMode) => void
  onRightPanelTabChange: (tab: 'match' | 'response' | 'preview') => void
  buttonClassName?: string
  dropdownClassName?: string
}) => (
  <div className="flex">
    <Button
      onClick={onAction}
      disabled={isAnalyzing || isSendingRequest}
      className={`rounded-r-none border-r-0 relative min-w-[110px] ${buttonClassName}`}
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
          className={`rounded-l-none px-2 ${dropdownClassName}`}
          disabled={isAnalyzing || isSendingRequest}
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

const UrlInput = ({
  url,
  onUrlChange,
  urlValidation,
  urlHistory,
  urlHistoryIndex,
  onUrlHistoryIndexChange,
  showUrlHistory,
  onShowUrlHistoryChange,
  urlInputFocusedRef,
  onUrlKeyDown,
  className = '',
}: {
  url: string
  onUrlChange: (url: string) => void
  urlValidation: { isValid: boolean; isEmpty: boolean; message: string }
  urlHistory: string[]
  urlHistoryIndex: number
  onUrlHistoryIndexChange: (i: number) => void
  showUrlHistory: boolean
  onShowUrlHistoryChange: (show: boolean) => void
  urlInputFocusedRef: React.MutableRefObject<boolean>
  onUrlKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  className?: string
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className={`relative ${className}`}>
        <Input
          placeholder="Enter request URL (e.g., https://api.example.com/users)"
          value={url}
          onChange={(e) => { onUrlChange(e.target.value); onUrlHistoryIndexChange(-1) }}
          onFocus={(e) => {
            if (!urlInputFocusedRef.current) {
              e.target.select()
              urlInputFocusedRef.current = true
            }
          }}
          onBlur={() => { urlInputFocusedRef.current = false; onShowUrlHistoryChange(false) }}
          onDoubleClick={() => { if (urlHistory.length > 0) onShowUrlHistoryChange(!showUrlHistory) }}
          onKeyDown={onUrlKeyDown}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text')
            const match = pasted.match(/(https?:\/\/\S+)/)
            if (match) {
              e.preventDefault()
              const raw = pasted.slice(pasted.indexOf(match[1]))
              onUrlChange(raw.replace(/[\s\r\n]+/g, ''))
            }
          }}
          className={`bg-background ${!urlValidation.isValid && !urlValidation.isEmpty ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          title="↑↓ to browse URL history | Double-click to show history"
        />
        {showUrlHistory && urlHistory.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden max-h-60 overflow-y-auto">
            {urlHistory.map((histUrl, i) => (
              <button
                key={i}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-muted truncate block ${i === urlHistoryIndex ? 'bg-muted' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onUrlChange(histUrl)
                  onUrlHistoryIndexChange(-1)
                  onShowUrlHistoryChange(false)
                }}
              >
                {histUrl}
              </button>
            ))}
          </div>
        )}
      </div>
    </TooltipTrigger>
    {!urlValidation.isValid && !urlValidation.isEmpty && (
      <TooltipContent side="bottom" className="bg-destructive text-destructive-foreground">
        <p>{urlValidation.message}</p>
      </TooltipContent>
    )}
  </Tooltip>
)

export function StandardOperationPanel({
  method,
  onMethodChange,
  url,
  onUrlChange,
  urlValidation,
  urlHistory,
  urlHistoryIndex,
  onUrlHistoryIndexChange,
  showUrlHistory,
  onShowUrlHistoryChange,
  urlInputFocusedRef,
  onUrlKeyDown,
  actionMode,
  onActionModeChange,
  isAnalyzing,
  isSendingRequest,
  onAction,
  onRightPanelTabChange,
  isLocalhostInBrowserMode,
  relayConnections,
  onSelectRelay,
}: StandardOperationPanelProps) {
  const localDevConnection = relayConnections.find((c) => c.type === 'local-dev')
  const hasLocalDevConnection = relayConnections.some((c) => c.type === 'local-dev')

  return (
    <div className="flex flex-col gap-2">
      {/* Mobile/narrow layout: method + button on one row, URL below */}
      <div className="flex gap-2 items-center justify-between xl:hidden">
        <Select value={method} onValueChange={onMethodChange}>
          <SelectTrigger className="w-[100px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {HTTP_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                <span className={methodColorClass(m)}>{m}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ActionButton
          actionMode={actionMode}
          isAnalyzing={isAnalyzing}
          isSendingRequest={isSendingRequest}
          onAction={onAction}
          onActionModeChange={onActionModeChange}
          onRightPanelTabChange={onRightPanelTabChange}
        />
      </div>

      <UrlInput
        url={url}
        onUrlChange={onUrlChange}
        urlValidation={urlValidation}
        urlHistory={urlHistory}
        urlHistoryIndex={urlHistoryIndex}
        onUrlHistoryIndexChange={onUrlHistoryIndexChange}
        showUrlHistory={showUrlHistory}
        onShowUrlHistoryChange={onShowUrlHistoryChange}
        urlInputFocusedRef={urlInputFocusedRef}
        onUrlKeyDown={onUrlKeyDown}
        className="xl:hidden"
      />

      {/* Localhost-in-browser-mode warning */}
      {isLocalhostInBrowserMode && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 xl:hidden">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>Localhost target detected.</strong> Browser mode cannot reach local services on
            another machine. Start a local relay or{' '}
            <button
              className="underline underline-offset-2 hover:no-underline"
              onClick={() => onSelectRelay(localDevConnection?.id ?? null)}
            >
              switch to a local relay connection
            </button>
            {!hasLocalDevConnection && (
              <> — <a href="/connections" className="underline underline-offset-2 hover:no-underline">set one up</a></>
            )}.
          </span>
        </div>
      )}

      {/* Desktop xl+ layout: method + URL + button all on one row */}
      <div className="hidden xl:flex gap-2">
        <Select value={method} onValueChange={onMethodChange}>
          <SelectTrigger className="w-[120px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {HTTP_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                <span className={methodColorClass(m)}>{m}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <UrlInput
          url={url}
          onUrlChange={onUrlChange}
          urlValidation={urlValidation}
          urlHistory={urlHistory}
          urlHistoryIndex={urlHistoryIndex}
          onUrlHistoryIndexChange={onUrlHistoryIndexChange}
          showUrlHistory={showUrlHistory}
          onShowUrlHistoryChange={onShowUrlHistoryChange}
          urlInputFocusedRef={urlInputFocusedRef}
          onUrlKeyDown={onUrlKeyDown}
          className="flex-1"
        />

        <ActionButton
          actionMode={actionMode}
          isAnalyzing={isAnalyzing}
          isSendingRequest={isSendingRequest}
          onAction={onAction}
          onActionModeChange={onActionModeChange}
          onRightPanelTabChange={onRightPanelTabChange}
        />
      </div>

      {/* Localhost warning for desktop */}
      {isLocalhostInBrowserMode && (
        <div className="hidden xl:flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>Localhost target detected.</strong> Browser mode cannot reach local services on
            another machine. Start a local relay or{' '}
            <button
              className="underline underline-offset-2 hover:no-underline"
              onClick={() => onSelectRelay(localDevConnection?.id ?? null)}
            >
              switch to a local relay connection
            </button>
            {!hasLocalDevConnection && (
              <> — <a href="/connections" className="underline underline-offset-2 hover:no-underline">set one up</a></>
            )}.
          </span>
        </div>
      )}
    </div>
  )
}
