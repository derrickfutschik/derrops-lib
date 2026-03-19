import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { JMESPathInputRow } from './JMESPathInputRow'
import { JsonViewPanel } from './JsonViewPanel'
import { MarkdownViewPanel } from './MarkdownViewPanel'
import { TableViewPanel } from './TableViewPanel'
import { StatusRibbon } from './StatusRibbon'
import { ViewModeTabs } from './ViewModeTabs'
import { Keyboard, Minimize2, Play } from 'lucide-react'
import React, { useRef, useEffect } from 'react'
import type { JoiningContext, JoinColumnCandidate } from './joining-utils'

type ViewMode = 'json' | 'markdown' | 'table'

type JsonStats =
  | { type: 'array'; count: number; totalKeys: number }
  | { type: 'object'; keys: number; totalKeys: number; depth: number }
  | null

interface MaximizedViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onShowHotkeyInfo: () => void
  // Header
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  viewValidity: { json: boolean; markdown: boolean; table: boolean }
  actionButtons: React.ReactNode
  // Send request
  onSendRequest?: () => void
  isSendingRequest?: boolean
  // JMESPath row
  isJson: boolean
  jmespathEnabled: boolean
  jmespathQuery: string
  jmespathMode: 'filter' | 'highlight'
  jmespathError: string | null
  jmespathNullResult: boolean
  onQueryChange: (value: string) => void
  onQueryProgrammatic: (value: string) => void
  onEnabledChange: (enabled: boolean) => void
  onModeChange: (mode: 'filter' | 'highlight') => void
  onToggleHighlight: () => void
  onToggleFilter: () => void
  onApplyWildcard: () => void
  onToggleTruncateValues: () => void
  onToggleUniqueFilter: () => void
  undoStackRef: React.MutableRefObject<string[]>
  redoStackRef: React.MutableRefObject<string[]>
  typingStartRef: React.MutableRefObject<string | null>
  undoDebounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  jsonContent?: string
  // Content
  renderedContent: React.ReactNode
  displayContent: string
  joiningContext: JoiningContext | null
  joinColumnCandidates: JoinColumnCandidate[][]
  tableDataRef: React.MutableRefObject<{ columns: string[]; rows: string[][] } | null>
  sqlResultRef: React.MutableRefObject<{ columns: string[]; rows: string[][] } | null>
  highlightDuplicates: boolean
  onViewerKeyDown: (e: React.KeyboardEvent, preRef: React.RefObject<HTMLPreElement>) => void
  // Status ribbon
  jsonStats: JsonStats
  duplicateCount: number
  lineCount: number
  filterPercent: number | null
}

export function MaximizedViewDialog({
  open,
  onOpenChange,
  onShowHotkeyInfo,
  onSendRequest,
  isSendingRequest = false,
  viewMode,
  onViewModeChange,
  viewValidity,
  actionButtons,
  isJson,
  jmespathEnabled,
  jmespathQuery,
  jmespathMode,
  jmespathError,
  jmespathNullResult,
  onQueryChange,
  onQueryProgrammatic,
  onEnabledChange,
  onModeChange,
  onToggleHighlight,
  onToggleFilter,
  onApplyWildcard,
  onToggleTruncateValues,
  onToggleUniqueFilter,
  undoStackRef,
  redoStackRef,
  typingStartRef,
  undoDebounceRef,
  jsonContent,
  renderedContent,
  displayContent,
  joiningContext,
  joinColumnCandidates,
  tableDataRef,
  sqlResultRef,
  highlightDuplicates,
  onViewerKeyDown,
  jsonStats,
  duplicateCount,
  lineCount,
  filterPercent,
}: MaximizedViewDialogProps) {
  const dialogPreRef = useRef<HTMLPreElement>(null)
  const dialogContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        dialogContentRef.current?.focus()
      })
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={() => { /* only close via X button */ }}>
      <DialogContent
        className="max-w-[100vw] w-[100vw] max-h-[100vh] h-[100vh] rounded-none border-none flex flex-col p-0 [&>button:last-child]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <ViewModeTabs
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                viewValidity={viewValidity}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={onShowHotkeyInfo}
                title="Keyboard shortcuts"
              >
                <Keyboard className="h-3.5 w-3.5" />
              </Button>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {onSendRequest && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 w-[5.75rem] px-3 text-xs gap-1.5 justify-center"
                    onClick={onSendRequest}
                    disabled={isSendingRequest}
                    title="Send request (⌘ Enter)"
                  >
                    {isSendingRequest ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    {isSendingRequest ? 'Sending…' : 'Send'}
                  </Button>
                  <div className="w-px h-4 bg-border" />
                </>
              )}
              {actionButtons}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onOpenChange(false)}
                title="Minimize"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        {isJson && (
          <JMESPathInputRow
            jmespathEnabled={jmespathEnabled}
            jmespathQuery={jmespathQuery}
            jmespathMode={jmespathMode}
            jmespathError={jmespathError}
            jmespathNullResult={jmespathNullResult}
            onQueryChange={onQueryChange}
            onQueryProgrammatic={onQueryProgrammatic}
            onEnabledChange={onEnabledChange}
            onModeChange={onModeChange}
            onToggleHighlight={onToggleHighlight}
            onToggleFilter={onToggleFilter}
            onApplyWildcard={onApplyWildcard}
            onToggleTruncateValues={onToggleTruncateValues}
            onToggleUniqueFilter={onToggleUniqueFilter}
            undoStackRef={undoStackRef}
            redoStackRef={redoStackRef}
            typingStartRef={typingStartRef}
            undoDebounceRef={undoDebounceRef}
            jsonContent={jsonContent}
            inTableView={viewMode === 'table'}
          />
        )}
        <div
          ref={dialogContentRef}
          className="flex-1 overflow-auto p-0 outline-none"
          tabIndex={0}
          onKeyDown={viewMode === 'json' ? (e) => onViewerKeyDown(e, dialogPreRef) : undefined}
        >
          {viewMode === 'json' && (
            <JsonViewPanel renderedContent={renderedContent} preRef={dialogPreRef} padding="p-6" />
          )}
          {viewMode === 'markdown' && <MarkdownViewPanel displayContent={displayContent} />}
          {viewMode === 'table' && (
            <TableViewPanel
              displayContent={displayContent}
              joiningContext={joiningContext}
              joinColumnCandidates={joinColumnCandidates}
              tableDataRef={tableDataRef}
              sqlResultRef={sqlResultRef}
              highlightDuplicates={highlightDuplicates}
            />
          )}
        </div>
        <StatusRibbon
          viewMode={viewMode}
          jmespathError={jmespathError}
          jsonStats={jsonStats}
          duplicateCount={duplicateCount}
          lineCount={lineCount}
          displayContentLength={displayContent.length}
          filterPercent={filterPercent}
          className="px-6 py-2 flex-shrink-0"
        />
      </DialogContent>
    </Dialog>
  )
}
