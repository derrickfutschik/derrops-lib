import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import jmespath from 'jmespath'
import { Filter, Highlighter } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extractWildcardPaths, fuzzySearchPaths } from './jmespath-autocomplete-utils'

// ---------------------------------------------------------------------------
// Module-level pure helpers (stable references, never recreated per render)
// ---------------------------------------------------------------------------

export function hasColoredJmespathTokens(query: string): boolean {
  if (/\[(\d+|\*)\]/.test(query)) return true
  return /\[\]/.test(query.replace(/(\[\])+$/, ''))
}

export function highlightJmespathQuery(query: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const trailingStart = query.replace(/(\[\])+$/, '').length
  const regex = /\[(\d+|\*|)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(query)) !== null) {
    if (match.index > lastIndex) parts.push(query.slice(lastIndex, match.index))
    const content = match[1]
    if (content === '') {
      if (match.index < trailingStart) {
        parts.push(
          <span key={match.index} className="text-green-500">
            []
          </span>,
        )
      } else {
        parts.push('[]')
      }
    } else {
      const isWildcard = content === '*'
      parts.push(
        <span key={match.index} className={isWildcard ? 'text-green-500' : 'text-orange-500'}>
          [{content}]
        </span>,
      )
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
  disabled?: boolean
  /** Raw JSON string — used to extract autocomplete paths */
  jsonContent?: string
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
  jsonContent,
}: JMESPathInputRowProps) {
  const [jmespathInputFocused, setJmespathInputFocused] = useState(false)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)

  const isInputFocusedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)
  const autocompleteItemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const setJmespathQueryRef = useRef(onQueryChange)
  setJmespathQueryRef.current = onQueryChange

  // ---------------------------------------------------------------------------
  // Parse JSON content once; derive wildcard paths from it
  // ---------------------------------------------------------------------------
  const parsedJsonContent = useMemo(() => {
    if (!jsonContent) return null
    try {
      return JSON.parse(jsonContent)
    } catch {
      return null
    }
  }, [jsonContent])

  const allPaths = useMemo(() => {
    if (!parsedJsonContent) return []
    return extractWildcardPaths(parsedJsonContent)
  }, [parsedJsonContent])

  // ---------------------------------------------------------------------------
  // Autocomplete suggestions
  //
  // Strategy (in order of preference):
  // 1. Eval approach — when the current query (or query minus trailing `.`/`[`)
  //    evaluates to a non-null *object* (not array), extract child paths from
  //    that object and prepend the evaluated query.  This handles numeric-index
  //    expressions like `hits[2].document` robustly.
  // 2. Fuzzy search fallback — case-insensitive term search against all
  //    wildcard paths extracted from the root JSON.  Handles partial typing,
  //    [*] expressions, and unknown prefixes.
  //
  // Options always use [*] to preserve JSON structure.  The caller decides
  // whether to append [] for table-view flattening after a suggestion is
  // accepted.
  // ---------------------------------------------------------------------------
  const autocompleteSuggestions = useMemo(() => {
    if (!jmespathEnabled || !jmespathInputFocused) return []
    const query = jmespathQuery.trim()

    // Eval approach: strip trailing `.` or `[` so partial typing still works,
    // then evaluate the expression against the parsed JSON root.
    if (query && parsedJsonContent) {
      let evalQuery = query
      if (evalQuery.endsWith('.') || evalQuery.endsWith('[')) {
        evalQuery = evalQuery.slice(0, -1).trim()
      }
      if (evalQuery) {
        try {
          const result = jmespath.search(parsedJsonContent, evalQuery)
          // Only use eval approach for object results — for arrays, the fuzzy
          // search against allPaths (which uses [*] prefixes) is more accurate.
          if (
            result !== null &&
            result !== undefined &&
            typeof result === 'object' &&
            !Array.isArray(result)
          ) {
            const childPaths = extractWildcardPaths(result)
            if (childPaths.length > 0) {
              const suggestions = childPaths.map((p) =>
                p.startsWith('[') ? `${evalQuery}${p}` : `${evalQuery}.${p}`,
              )
              const filtered = [...new Set(suggestions)].filter((s) => s !== query)
              if (filtered.length > 0) {
                filtered.sort((a, b) => a.length - b.length || a.localeCompare(b))
                return filtered.slice(0, 15)
              }
            }
          }
        } catch {
          /* fall through to fuzzy search */
        }
      }
    }

    if (allPaths.length === 0) return []
    const results = fuzzySearchPaths(allPaths, query)
    if (results.length === 1 && results[0] === query) return []
    return results.slice(0, 15)
  }, [allPaths, parsedJsonContent, jmespathQuery, jmespathEnabled, jmespathInputFocused])

  useEffect(() => {
    if (!showAutocomplete || autocompleteSuggestions.length === 0) return
    const nextIndex = Math.min(autocompleteIndex, autocompleteSuggestions.length - 1)
    if (nextIndex !== autocompleteIndex) {
      setAutocompleteIndex(nextIndex)
      return
    }
    autocompleteItemRefs.current[nextIndex]?.scrollIntoView({ block: 'nearest' })
  }, [autocompleteIndex, autocompleteSuggestions, showAutocomplete])

  const selectAutocomplete = useCallback(
    (path: string) => {
      onQueryProgrammatic(path)
      setShowAutocomplete(false)
    },
    [onQueryProgrammatic],
  )

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 border-b border-border ${disabled ? 'bg-muted/50 opacity-50 pointer-events-none' : 'bg-muted/20'}`}
    >
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
          onChange={(e) => {
            onQueryChange(e.target.value)
            setShowAutocomplete(true)
            setAutocompleteIndex(0)
          }}
          onFocus={() => {
            isInputFocusedRef.current = true
            setJmespathInputFocused(true)
            setShowAutocomplete(true)
            setAutocompleteIndex(0)
          }}
          onBlur={() => {
            isInputFocusedRef.current = false
            setTimeout(() => {
              setShowAutocomplete(false)
              setJmespathInputFocused(false)
            }, 150)
          }}
          onKeyDownCapture={(e) => {
            const hasSuggestions = autocompleteSuggestions.length > 0

            if (hasSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              e.stopPropagation()
              if (!showAutocomplete) {
                setShowAutocomplete(true)
                setAutocompleteIndex(e.key === 'ArrowDown' ? 0 : autocompleteSuggestions.length - 1)
                return
              }
              setAutocompleteIndex((prev) => {
                if (e.key === 'ArrowDown') {
                  return Math.min(prev + 1, autocompleteSuggestions.length - 1)
                }
                return Math.max(prev - 1, 0)
              })
              return
            }

            // --- Autocomplete navigation ---
            if (showAutocomplete && hasSuggestions) {
              if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                selectAutocomplete(autocompleteSuggestions[autocompleteIndex])
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setShowAutocomplete(false)
                return
              }
            }
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
              if (undoDebounceRef.current) {
                clearTimeout(undoDebounceRef.current)
                undoDebounceRef.current = null
                if (typingStartRef.current !== null) {
                  undoStackRef.current = [...undoStackRef.current, typingStartRef.current].slice(
                    -100,
                  )
                  typingStartRef.current = null
                }
              }
              if (undoStackRef.current.length === 0) return
              const prev = undoStackRef.current[undoStackRef.current.length - 1]
              undoStackRef.current = undoStackRef.current.slice(0, -1)
              redoStackRef.current = [...redoStackRef.current, jmespathQuery]
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
              setJmespathQueryRef.current(next)
              return
            }
          }}
          disabled={!jmespathEnabled}
          className={`h-7 text-xs font-mono ${jmespathError || jmespathNullResult ? 'border-destructive' : ''}`}
          style={
            !jmespathInputFocused && hasColoredJmespathTokens(jmespathQuery)
              ? { color: 'transparent', caretColor: 'hsl(var(--foreground))' }
              : undefined
          }
          onScroll={(e) => {
            if (overlayRef.current) overlayRef.current.scrollLeft = e.currentTarget.scrollLeft
          }}
          title="Tab to accept suggestion | ↑↓ navigate suggestions | Esc dismiss"
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
        {/* Autocomplete dropdown */}
        {showAutocomplete && autocompleteSuggestions.length > 0 && (
          <div
            ref={autocompleteRef}
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-md overflow-y-auto max-h-[240px]"
          >
            {autocompleteSuggestions.map((path, i) => {
              const isSelected = i === autocompleteIndex
              return (
                <button
                  key={path}
                  ref={(node) => {
                    autocompleteItemRefs.current[i] = node
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate block transition-colors ${
                    isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectAutocomplete(path)
                  }}
                  onMouseEnter={() => setAutocompleteIndex(i)}
                >
                  {highlightPathMatch(path, jmespathQuery)}
                </button>
              )
            })}
            <div className="px-3 py-1 text-[10px] text-muted-foreground border-t border-border">
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Tab</kbd> accept ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd> navigate ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> dismiss
            </div>
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

// ---------------------------------------------------------------------------
// Helper: highlight matching terms in a path for the autocomplete dropdown
// ---------------------------------------------------------------------------
function highlightPathMatch(path: string, query: string): React.ReactNode {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return path

  const highlights = new Set<number>()
  const lowerPath = path.toLowerCase()
  for (const term of terms) {
    let searchFrom = 0
    while (searchFrom < lowerPath.length) {
      const idx = lowerPath.indexOf(term, searchFrom)
      if (idx === -1) break
      for (let i = idx; i < idx + term.length; i++) highlights.add(i)
      searchFrom = idx + 1
    }
  }

  if (highlights.size === 0) return path

  const parts: React.ReactNode[] = []
  let i = 0
  while (i < path.length) {
    const isHighlighted = highlights.has(i)
    let j = i + 1
    while (j < path.length && highlights.has(j) === isHighlighted) j++
    const segment = path.slice(i, j)
    if (isHighlighted) {
      parts.push(
        <span key={i} className="font-bold underline decoration-primary underline-offset-2">
          {segment}
        </span>,
      )
    } else {
      parts.push(segment)
    }
    i = j
  }
  return <>{parts}</>
}
