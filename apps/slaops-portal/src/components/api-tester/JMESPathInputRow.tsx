import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Filter, Highlighter } from 'lucide-react'
import React, { useState, useRef, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Module-level pure helpers (stable references, never recreated per render)
// ---------------------------------------------------------------------------

/**
 * Returns true if the query contains tokens that will be colored —
 * used to decide whether to activate the overlay. Trailing `[]` at the end
 * of the expression are not highlighted, so they don't count.
 */
export function hasColoredJmespathTokens(query: string): boolean {
  if (/\[(\d+|\*)\]/.test(query)) return true
  // [] is green only when not trailing; strip trailing []s and check what remains
  return /\[\]/.test(query.replace(/(\[\])+$/, ''))
}

/**
 * Renders a JMESPath query string as React nodes:
 *  - `[0]`, `[12]` → red  (concrete indices)
 *  - `[*]`, `[]`   → green (wildcards), EXCEPT `[]` tokens at the very end of
 *                    the expression (one or more) which are left unstyled.
 */
export function highlightJmespathQuery(query: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // Determine where the trailing []...[] sequence starts so we can skip them.
  const trailingStart = query.replace(/(\[\])+$/, '').length
  const regex = /\[(\d+|\*|)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(query)) !== null) {
    if (match.index > lastIndex) parts.push(query.slice(lastIndex, match.index))
    const content = match[1]
    if (content === '') {
      // [] — green only when not part of the trailing sequence
      if (match.index < trailingStart) {
        parts.push(<span key={match.index} className="text-green-500">[]</span>)
      } else {
        parts.push('[]')
      }
    } else {
      const isWildcard = content === '*'
      parts.push(<span key={match.index} className={isWildcard ? 'text-green-500' : 'text-orange-500'}>[{content}]</span>)
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < query.length) parts.push(query.slice(lastIndex))
  return parts
}

export interface JMESPathState {
  enabled: boolean
  query: string
  mode: 'filter' | 'highlight'
}

export interface JMESPathInputRowProps {
  // Redux-derived (read)
  jmespathEnabled: boolean
  jmespathQuery: string
  jmespathMode: 'filter' | 'highlight'
  jmespathError: string | null
  jmespathNullResult: boolean
  // Undo-aware mutations (parent owns undo stacks)
  onQueryChange: (value: string) => void
  onQueryProgrammatic: (value: string) => void
  // Toggle / dispatch callbacks
  onEnabledChange: (enabled: boolean) => void
  onModeChange: (mode: 'filter' | 'highlight') => void
  onToggleHighlight: () => void
  onToggleFilter: () => void
  onApplyWildcard: () => void
  onToggleTruncateValues: () => void
  onToggleUniqueFilter: () => void
  // Undo stack refs (owned by parent, used for undo/redo in key handler)
  undoStackRef: React.MutableRefObject<string[]>
  redoStackRef: React.MutableRefObject<string[]>
  typingStartRef: React.MutableRefObject<string | null>
  undoDebounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  disabled?: boolean
}

export function JMESPathInputRow({
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
  disabled = false,
}: JMESPathInputRowProps) {
  const [jmespathHistory, setJmespathHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showHistory, setShowHistory] = useState(false)
  const [jmespathInputFocused, setJmespathInputFocused] = useState(false)

  const isInputFocusedRef = useRef(false)
  const savedQueryRef = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Stable ref so we can call setJmespathQuery without it being in dep arrays
  const setJmespathQueryRef = useRef(onQueryChange)
  setJmespathQueryRef.current = onQueryChange

  const addToHistory = useCallback((query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setJmespathHistory((prev) => {
      const filtered = prev.filter((h) => h !== trimmed)
      return [trimmed, ...filtered].slice(0, 10)
    })
  }, [])

  // Track previous query to detect external changes (cmd+click from JSON viewer)
  const prevQueryRef = useRef(jmespathQuery)
  useEffect(() => {
    if (prevQueryRef.current !== jmespathQuery && !isInputFocusedRef.current) {
      addToHistory(jmespathQuery)
      setHistoryIndex(-1)
    }
    prevQueryRef.current = jmespathQuery
  }, [jmespathQuery, addToHistory])

  return (
    <div className={`flex items-center gap-3 px-3 py-2 border-b border-border ${disabled ? 'bg-muted/50 opacity-50 pointer-events-none' : 'bg-muted/20'}`}>
      <div className="flex items-center gap-2">
        <Switch
          id="jmespath-toggle"
          checked={jmespathEnabled}
          onCheckedChange={onEnabledChange}
          className="scale-75"
        />
        <Label
          htmlFor="jmespath-toggle"
          className="text-xs font-medium text-muted-foreground cursor-pointer"
        >
          JMESPath
        </Label>
      </div>
      <div className="flex-1 relative">
        <Input
          ref={inputRef}
          placeholder="e.g. data[0].name, items[?status=='active']"
          value={jmespathQuery}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => {
            isInputFocusedRef.current = true
            setJmespathInputFocused(true)
          }}
          onBlur={() => {
            isInputFocusedRef.current = false
            setShowHistory(false)
            setJmespathInputFocused(false)
          }}
          onDoubleClick={() => {
            if (jmespathHistory.length > 0) setShowHistory(true)
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
              e.preventDefault()
              onToggleHighlight()
              return
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
              e.preventDefault()
              onToggleFilter()
              return
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '8') {
              e.preventDefault()
              onApplyWildcard()
              return
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
              e.preventDefault()
              onToggleTruncateValues()
              return
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
              e.preventDefault()
              onToggleUniqueFilter()
              return
            }
            // Undo: Cmd+Z
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
              e.preventDefault()
              // Flush any pending debounce first
              if (undoDebounceRef.current) {
                clearTimeout(undoDebounceRef.current)
                undoDebounceRef.current = null
                if (typingStartRef.current !== null) {
                  undoStackRef.current = [...undoStackRef.current, typingStartRef.current].slice(-100)
                  typingStartRef.current = null
                }
              }
              if (undoStackRef.current.length === 0) return
              const prev = undoStackRef.current[undoStackRef.current.length - 1]
              undoStackRef.current = undoStackRef.current.slice(0, -1)
              redoStackRef.current = [...redoStackRef.current, jmespathQuery]
              setHistoryIndex(-1)
              setJmespathQueryRef.current(prev)
              return
            }
            // Redo: Cmd+Shift+Z or Cmd+Y
            if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
              e.preventDefault()
              if (redoStackRef.current.length === 0) return
              const next = redoStackRef.current[redoStackRef.current.length - 1]
              redoStackRef.current = redoStackRef.current.slice(0, -1)
              undoStackRef.current = [...undoStackRef.current, jmespathQuery]
              setHistoryIndex(-1)
              setJmespathQueryRef.current(next)
              return
            }
            if (e.key === 'Enter') {
              if (historyIndex !== -1) {
                // Committing a history navigation — push saved query to undo stack
                onQueryProgrammatic(jmespathQuery)
              }
              addToHistory(jmespathQuery)
              setHistoryIndex(-1)
              return
            }
            if (e.key === 'Escape') {
              if (showHistory) {
                setShowHistory(false)
                return
              }
              if (historyIndex !== -1) {
                setHistoryIndex(-1)
                // Revert to the saved query without affecting undo stack
                setJmespathQueryRef.current(savedQueryRef.current)
              }
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (jmespathHistory.length === 0) return
              if (historyIndex === -1) {
                savedQueryRef.current = jmespathQuery
              }
              const newIndex = Math.min(historyIndex + 1, jmespathHistory.length - 1)
              setHistoryIndex(newIndex)
              // Temporary navigation — no undo push
              setJmespathQueryRef.current(jmespathHistory[newIndex])
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (historyIndex === -1) return
              const newIndex = historyIndex - 1
              setHistoryIndex(newIndex)
              // Temporary navigation — no undo push
              setJmespathQueryRef.current(newIndex === -1 ? savedQueryRef.current : jmespathHistory[newIndex])
              return
            }
          }}
          disabled={!jmespathEnabled}
          className={`h-7 text-xs font-mono ${jmespathError || jmespathNullResult ? 'border-destructive' : ''}`}
          style={!jmespathInputFocused && hasColoredJmespathTokens(jmespathQuery) ? { color: 'transparent', caretColor: 'hsl(var(--foreground))' } : undefined}
          onScroll={(e) => { if (overlayRef.current) overlayRef.current.scrollLeft = e.currentTarget.scrollLeft }}
          title="Cmd/Ctrl+8 to wildcard array indices | ↑↓ to browse history | Double-click to show history"
        />
        {!jmespathInputFocused && hasColoredJmespathTokens(jmespathQuery) && (
          <div
            ref={overlayRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 px-3 flex items-center text-xs font-mono overflow-hidden whitespace-pre"
          >
            {highlightJmespathQuery(jmespathQuery)}
          </div>
        )}
        {showHistory && jmespathHistory.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
            {jmespathHistory.map((expr, i) => (
              <button
                key={i}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-muted truncate block ${i === historyIndex ? 'bg-muted' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onQueryProgrammatic(expr)
                  setShowHistory(false)
                }}
              >
                {expr}
              </button>
            ))}
          </div>
        )}
      </div>
      <ToggleGroup
        type="single"
        value={jmespathMode}
        onValueChange={(val) => val && onModeChange(val as 'filter' | 'highlight')}
        disabled={!jmespathEnabled}
        className="gap-0"
      >
        <ToggleGroupItem
          value="filter"
          size="sm"
          className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          title="Filter: Show only matched data"
        >
          <Filter className="h-3 w-3" />
          <span className="hidden sm:inline">Filter</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="highlight"
          size="sm"
          className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          title="Highlight: Show all, highlight matches"
        >
          <Highlighter className="h-3 w-3" />
          <span className="hidden sm:inline">Highlight</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
