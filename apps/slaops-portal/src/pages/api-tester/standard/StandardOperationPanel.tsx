import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type KeyValuePair } from '@/hooks/useSendRequest'
import { selectFocusedQueryParam } from '@/store/apiTesterSlice'
import { useAppSelector } from '@/store/hooks'
import { AlertCircle, ChevronDown, Eye, Search, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ActionMode, HTTP_METHODS } from '../types'

interface StandardOperationPanelProps {
  method: string
  onMethodChange: (method: string) => void
  url: string
  onUrlChange: (url: string) => void
  queryParams: KeyValuePair[]
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
          onClick={() => {
            onActionModeChange('analyze')
            onRightPanelTabChange('match')
          }}
          className={actionMode === 'analyze' ? 'bg-accent' : ''}
        >
          <Search className="h-4 w-4 mr-2" />
          Match
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onActionModeChange('request')
            onRightPanelTabChange('response')
          }}
          className={actionMode === 'request' ? 'bg-accent' : ''}
        >
          <Send className="h-4 w-4 mr-2" />
          Request
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onActionModeChange('preview')
            onRightPanelTabChange('preview')
          }}
          className={actionMode === 'preview' ? 'bg-accent' : ''}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)

// Returns the character range [start, end) of the focused param's key or value
// within the full URL string, or null if it can't be found.
function getParamHighlightRange(
  url: string,
  params: KeyValuePair[],
  focused: { index: number; field: 'key' | 'value' },
): { start: number; end: number } | null {
  const { index, field } = focused
  if (index < 0 || index >= params.length) return null

  const param = params[index]
  if (!param.enabled || !param.key.trim()) return null

  const questionPos = url.indexOf('?')
  if (questionPos === -1) return null

  // Count how many times the same key appears before this index (for duplicate keys)
  let nthOccurrence = 0
  for (let i = 0; i < index; i++) {
    if (params[i].enabled && params[i].key === param.key) nthOccurrence++
  }

  const queryString = url.slice(questionPos + 1)
  let charOffset = questionPos + 1
  let occurrenceSeen = 0

  for (const segment of queryString.split('&')) {
    const eqIdx = segment.indexOf('=')
    const rawKey = eqIdx >= 0 ? segment.slice(0, eqIdx) : segment
    const decodedKey = (() => {
      try {
        return decodeURIComponent(rawKey)
      } catch {
        return rawKey
      }
    })()

    if (rawKey === param.key || decodedKey === param.key) {
      if (occurrenceSeen === nthOccurrence) {
        if (field === 'key') return { start: charOffset, end: charOffset + rawKey.length }
        if (eqIdx >= 0) return { start: charOffset + eqIdx + 1, end: charOffset + segment.length }
        return null
      }
      occurrenceSeen++
    }

    charOffset += segment.length + 1 // +1 for '&'
  }

  return null
}

const UrlInput = ({
  url,
  onUrlChange,
  queryParams,
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
  queryParams: KeyValuePair[]
  urlValidation: { isValid: boolean; isEmpty: boolean; message: string }
  urlHistory: string[]
  urlHistoryIndex: number
  onUrlHistoryIndexChange: (i: number) => void
  showUrlHistory: boolean
  onShowUrlHistoryChange: (show: boolean) => void
  urlInputFocusedRef: React.MutableRefObject<boolean>
  onUrlKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  className?: string
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const focusedQueryParam = useAppSelector(selectFocusedQueryParam)

  const highlightRange = useMemo(
    () => (focusedQueryParam ? getParamHighlightRange(url, queryParams, focusedQueryParam) : null),
    [url, queryParams, focusedQueryParam],
  )

  // Keep overlay scroll in sync with input scroll
  const syncScroll = useCallback(() => {
    requestAnimationFrame(() => {
      if (overlayRef.current && inputRef.current) {
        overlayRef.current.scrollLeft = inputRef.current.scrollLeft
      }
    })
  }, [])

  // Auto-scroll the URL input when the focused param changes so the highlighted
  // segment is centred in the visible area.
  useEffect(() => {
    if (!highlightRange || !inputRef.current) return

    const { start, end } = highlightRange
    const input = inputRef.current
    const computed = getComputedStyle(input)

    // Measure character-pixel widths using a throwaway span with the same font
    const measureEl = document.createElement('span')
    measureEl.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-size:${computed.fontSize};font-family:${computed.fontFamily};letter-spacing:${computed.letterSpacing};`
    document.body.appendChild(measureEl)
    measureEl.textContent = url.slice(0, start)
    const startPx = measureEl.getBoundingClientRect().width
    measureEl.textContent = url.slice(0, end)
    const endPx = measureEl.getBoundingClientRect().width
    document.body.removeChild(measureEl)

    // Centre the highlight in the visible area (subtract px-3 padding on each side)
    const paddingLeft = 12
    const availableWidth = input.clientWidth - paddingLeft * 2
    const midPx = (startPx + endPx) / 2
    const targetScrollLeft = Math.max(0, midPx - availableWidth / 2)

    input.scrollLeft = targetScrollLeft
    if (overlayRef.current) overlayRef.current.scrollLeft = targetScrollLeft
  }, [highlightRange?.start, highlightRange?.end, url])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`relative ${className}`}>
          <Input
            ref={inputRef}
            placeholder="Enter request URL (e.g., https://api.example.com/users)"
            value={url}
            onChange={(e) => {
              onUrlChange(e.target.value)
              onUrlHistoryIndexChange(-1)
              syncScroll()
            }}
            onFocus={(e) => {
              if (!urlInputFocusedRef.current) {
                e.target.select()
                urlInputFocusedRef.current = true
              }
            }}
            onBlur={() => {
              urlInputFocusedRef.current = false
              onShowUrlHistoryChange(false)
            }}
            onDoubleClick={() => {
              if (urlHistory.length > 0) onShowUrlHistoryChange(!showUrlHistory)
            }}
            onKeyDown={onUrlKeyDown}
            onScroll={syncScroll}
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
          {highlightRange && (
            <div
              ref={overlayRef}
              className="absolute inset-y-0 pointer-events-none select-none overflow-hidden"
              style={{
                // Align with the input's text area (px-3 = 12px padding on each side)
                left: '12px',
                right: '12px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                letterSpacing: 'inherit',
                whiteSpace: 'pre',
                color: 'transparent',
              }}
              aria-hidden="true"
            >
              {url.slice(0, highlightRange.start)}
              <mark
                style={{
                  background: 'rgba(34, 197, 94, 0.25)',
                  color: 'transparent',
                  borderRadius: '2px',
                  padding: 0,
                }}
              >
                {url.slice(highlightRange.start, highlightRange.end)}
              </mark>
              {url.slice(highlightRange.end)}
            </div>
          )}
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
}

export function StandardOperationPanel({
  method,
  onMethodChange,
  url,
  onUrlChange,
  queryParams,
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
        queryParams={queryParams}
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
              <>
                {' '}
                —{' '}
                <a href="/connections" className="underline underline-offset-2 hover:no-underline">
                  set one up
                </a>
              </>
            )}
            .
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
          queryParams={queryParams}
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
              <>
                {' '}
                —{' '}
                <a href="/connections" className="underline underline-offset-2 hover:no-underline">
                  set one up
                </a>
              </>
            )}
            .
          </span>
        </div>
      )}
    </div>
  )
}
