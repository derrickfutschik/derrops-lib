import { Button } from '@/components/ui/button'
import { HotkeyInfoDialog } from './HotkeyInfoDialog'
import { JsonViewPanel } from './JsonViewPanel'
import { JMESPathInputRow, type JMESPathState } from './JMESPathInputRow'
import { MarkdownViewPanel } from './MarkdownViewPanel'
import { MaximizedViewDialog } from './MaximizedViewDialog'
import { ResultsActionButtons } from './ResultsActionButtons'
import { StatusRibbon } from './StatusRibbon'
import { TableViewPanel } from './TableViewPanel'
import { ViewModeTabs } from './ViewModeTabs'
import { ArrowLeftRight, Keyboard, Maximize2 } from 'lucide-react'
import { useResultsActions } from './useResultsActions'
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { JsonResponseViewer } from './JsonResponseViewer'
import { detectJoiningContext, detectJoinColumnCandidates, type JoiningContext, type JoinColumnCandidate } from './joining-utils'
import {
  evaluateJmespathQuery,
  buildFilteredJmespathExpression,
  deduplicateJsonArray,
  countDuplicates,
  computeJsonStats,
  computeFilterPercent,
  EMPTY_JMESPATH_RESULT,
  type JmespathQueryResult,
} from './json-jmespath-utils'
import { highlightJson } from './json-highlight-renderer'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  selectSelectedView,
  selectHighlightDuplicates,
  selectJsonState,
  selectTableState,
  selectHiddenColumnIds,
  setSelectedView,
  setHighlightDuplicates as setHighlightDuplicatesRedux,
  setJmespathEnabled,
  setJmespathQuery as setJmespathQueryRedux,
  setJmespathMode,
  setTruncateValues as setTruncateValuesRedux,
  setUniqueFilter as setUniqueFilterRedux,
  setJsonState,
} from '@/store/responseViewerSlice'

export type { JMESPathState }

type ViewMode = 'json' | 'markdown' | 'table'

interface MaximizableCodeViewerProps {
  title: string
  content: string
  contentType?: string
  responseSchema?: any
  validationErrors?: Record<string, string>
  onFormat?: () => void
  showFormatButton?: boolean
  className?: string
  maxHeight?: string
  jmespathState?: JMESPathState
  onJMESPathStateChange?: (state: JMESPathState) => void
  onExpandToBottom?: () => void
  onCollapseFromBottom?: () => void
}

export function MaximizableCodeViewer({
  title,
  content,
  contentType = '',
  responseSchema,
  validationErrors,
  onFormat,
  showFormatButton = true,
  className = '',
  maxHeight = '400px',
  jmespathState,
  onJMESPathStateChange,
  onExpandToBottom,
  onCollapseFromBottom,
}: MaximizableCodeViewerProps) {
  const dispatch = useAppDispatch()
  const selectedView = useAppSelector(selectSelectedView)
  const highlightDuplicates = useAppSelector(selectHighlightDuplicates)
  const jsonState = useAppSelector(selectJsonState)
  const tableState = useAppSelector(selectTableState)
  const hiddenColumnIds = useAppSelector(selectHiddenColumnIds)
  // sqlQuery is only used for filename generation in handleDownload
  const sqlQuery = tableState.sqlQuery

  const [isMaximized, setIsMaximized] = useState(false)
  const [showHotkeyInfo, setShowHotkeyInfo] = useState(false)
  const setHighlightDuplicates = (val: boolean) => dispatch(setHighlightDuplicatesRedux(val))
  // truncateValues and uniqueFilter now come from Redux (jsonState)
  const truncateValues = jsonState.truncateValues
  const uniqueFilter = jsonState.uniqueFilter
  // viewMode from Redux
  const viewMode = selectedView as ViewMode
  const setViewMode = (v: ViewMode) => dispatch(setSelectedView(v))

  const tableDataRef = useRef<{ columns: string[]; rows: string[][] } | null>(null)
  const sqlResultRef = useRef<{ columns: string[]; rows: string[][] } | null>(null)
  // Tracks current displayContent for use in click handlers (defined after state/memos below)
  const displayContentRef = useRef(content)
  const normalPreRef = useRef<HTMLPreElement>(null)

  const applyWildcard = () => {
    const wildcarded = jmespathQuery.replace(/\[\d+\]/g, '[*]')
    const isCurrentlyWildcarded =
      savedPreWildcardRef.current !== null &&
      jmespathQuery === savedPreWildcardRef.current.replace(/\[\d+\]/g, '[*]')

    let newValue: string
    if (isCurrentlyWildcarded) {
      newValue = savedPreWildcardRef.current!
      savedPreWildcardRef.current = null
    } else {
      savedPreWildcardRef.current = jmespathQuery
      newValue = wildcarded
    }

    applyQueryProgrammatic(newValue)
  }

  // Stable ref so the global keydown handler (registered once with [] deps)
  // always calls the latest version of applyWildcard.
  const applyWildcardRef = useRef(applyWildcard)
  applyWildcardRef.current = applyWildcard

  const selectAllInViewer = useCallback((preRef: React.RefObject<HTMLPreElement>) => {
    const pre = preRef.current
    if (!pre) return
    const range = document.createRange()
    range.selectNodeContents(pre)
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }, [])

  // JMESPath state now lives in Redux; props provide backward compat initialization
  const prevQueryRef = useRef('')
  const savedPreWildcardRef = useRef<string | null>(null)
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])
  const typingStartRef = useRef<string | null>(null)
  const undoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Read JMESPath state from Redux
  const jmespathEnabled = jsonState.jmespathEnabled
  const jmespathQuery = jsonState.jmespathQuery
  const jmespathMode = jsonState.jmespathMode

  // Initialize Redux from props on first mount only (backward compat)
  const propsInitializedRef = useRef(false)
  useEffect(() => {
    if (propsInitializedRef.current) return
    propsInitializedRef.current = true
    if (jmespathState) {
      dispatch(setJsonState({
        jmespathEnabled: jmespathState.enabled,
        jmespathQuery: jmespathState.query,
        jmespathMode: jmespathState.mode,
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Notify parent when Redux JMESPath state changes (backward compat)
  const onJMESPathStateChangeRef = useRef(onJMESPathStateChange)
  onJMESPathStateChangeRef.current = onJMESPathStateChange
  useEffect(() => {
    if (!onJMESPathStateChangeRef.current) return
    onJMESPathStateChangeRef.current({ enabled: jmespathEnabled, query: jmespathQuery, mode: jmespathMode })
  }, [jmespathEnabled, jmespathQuery, jmespathMode])

  // Debounced query: lags behind jmespathQuery so expensive computations
  // only run after the user stops typing for 400ms.
  const [debouncedQuery, setDebouncedQuery] = useState(jmespathQuery)
  const queryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current)
    queryDebounceRef.current = setTimeout(() => {
      setDebouncedQuery(jmespathQuery)
      queryDebounceRef.current = null
    }, 600)
    return () => {
      if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current)
    }
  }, [jmespathQuery])

  const setJmespathEnabledLocal = (enabled: boolean) => {
    dispatch(setJmespathEnabled(enabled))
  }

  const setJmespathQuery = useCallback((query: string) => {
    dispatch(setJmespathQueryRedux(query))
  }, [dispatch])

  // Sets query AND enables JMESPath (used for Cmd+Click from JSON viewer)
  const selectJmespathQuery = useCallback((query: string) => {
    dispatch(setJsonState({ jmespathEnabled: true, jmespathQuery: query }))
  }, [dispatch])

  const setJmespathModeLocal = (mode: 'filter' | 'highlight') => {
    dispatch(setJmespathMode(mode))
  }

  // Applies a query change programmatically (history selection, wildcard, cmd+click).
  // Always pushes the current value onto the undo stack before changing.
  const applyQueryProgrammatic = (newValue: string) => {
    if (undoDebounceRef.current) {
      clearTimeout(undoDebounceRef.current)
      undoDebounceRef.current = null
    }
    const prev = typingStartRef.current ?? jmespathQuery
    typingStartRef.current = null

    // In table view, immediately evaluate and append [] if the result is an array of arrays.
    // This avoids waiting for the 600ms debounce before the auto-append effect fires.
    let finalValue = newValue
    if (viewMode === 'table' && isJson && jmespathMode === 'filter') {
      const trimmed = newValue.trim()
      if (trimmed && !trimmed.endsWith('[]')) {
        try {
          const result = evaluateJmespathQuery(getParsedContent(content), trimmed, jmespathMode)
          if (result.filteredContent) {
            const parsed = JSON.parse(result.filteredContent)
            if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
              finalValue = trimmed + '[]'
            }
          }
        } catch { /* leave finalValue as-is */ }
      }
    }

    if (prev !== finalValue) {
      undoStackRef.current = [...undoStackRef.current, prev].slice(-100)
      redoStackRef.current = []
    }
    setJmespathQuery(finalValue)
  }

  // Handles user typing: debounces pushing the pre-typing value onto the undo stack.
  const handleQueryChange = (newValue: string) => {
    if (typingStartRef.current === null) {
      typingStartRef.current = jmespathQuery
    }
    if (undoDebounceRef.current) clearTimeout(undoDebounceRef.current)
    undoDebounceRef.current = setTimeout(() => {
      if (typingStartRef.current !== null) {
        undoStackRef.current = [...undoStackRef.current, typingStartRef.current].slice(-100)
        redoStackRef.current = []
        typingStartRef.current = null
      }
      undoDebounceRef.current = null
    }, 600)
    setJmespathQuery(newValue)
  }

  const toggleHighlightMode = useCallback(() => {
    // Enable JMESPath in highlight mode (like ⌘Click), or toggle off if already active
    const isActiveHighlight = jmespathEnabled && jmespathMode === 'highlight'
    if (isActiveHighlight) {
      dispatch(setJmespathEnabled(false))
    } else {
      dispatch(setJsonState({ jmespathEnabled: true, jmespathMode: 'highlight' }))
    }
  }, [jmespathEnabled, jmespathMode, dispatch])

  const toggleTruncateValues = useCallback(() => {
    dispatch(setTruncateValuesRedux(!truncateValues))
  }, [dispatch, truncateValues])

  const toggleUniqueFilter = useCallback(() => {
    dispatch(setUniqueFilterRedux(!uniqueFilter))
  }, [dispatch, uniqueFilter])

  const toggleFilterMode = useCallback(() => {
    // Enable JMESPath in filter mode (like ⌘Click), or toggle off if already active
    const isActiveFilter = jmespathEnabled && jmespathMode === 'filter'
    if (isActiveFilter) {
      dispatch(setJmespathEnabled(false))
    } else {
      dispatch(setJsonState({ jmespathEnabled: true, jmespathMode: 'filter' }))
    }
  }, [jmespathEnabled, jmespathMode, dispatch])

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (e.key === 'h') {
        if (tag === 'input' || tag === 'textarea' || tag === 'pre') return
        e.preventDefault()
        setShowHotkeyInfo(true)
      } else if (e.key === '8') {
        // Fire applyWildcard when not in any text input/textarea and not already
        // handled by a focused element (e.g. the viewer div or the JMESPath input).
        if (tag === 'input' || tag === 'textarea' || e.defaultPrevented) return
        e.preventDefault()
        applyWildcardRef.current()
      }
    }
    document.addEventListener('keydown', handleGlobalKey)
    return () => document.removeEventListener('keydown', handleGlobalKey)
  }, [])

  const handleViewerKeyDown = (e: React.KeyboardEvent, preRef: React.RefObject<HTMLPreElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      toggleHighlightMode()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault()
      toggleFilterMode()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault()
      selectAllInViewer(preRef)
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '8') {
      e.preventDefault()
      applyWildcard()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault()
      toggleTruncateValues()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
      e.preventDefault()
      toggleUniqueFilter()
    }
    // Undo JMESPath: Cmd+Z
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault()
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
      setJmespathQuery(prev)
      return
    }
    // Redo JMESPath: Cmd+Shift+Z or Cmd+Y
    if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault()
      if (redoStackRef.current.length === 0) return
      const next = redoStackRef.current[redoStackRef.current.length - 1]
      redoStackRef.current = redoStackRef.current.slice(0, -1)
      undoStackRef.current = [...undoStackRef.current, jmespathQuery]
      setJmespathQuery(next)
      return
    }
  }

  // Push the old value onto the undo stack when query changes externally
  // (e.g. cmd+click from JSON viewer). History management is handled by JMESPathInputRow.
  useEffect(() => {
    if (prevQueryRef.current !== jmespathQuery) {
      const old = prevQueryRef.current
      if (old !== jmespathQuery) {
        undoStackRef.current = [...undoStackRef.current, old].slice(-100)
        redoStackRef.current = []
      }
    }
    prevQueryRef.current = jmespathQuery
  }, [jmespathQuery])

  const isJson = contentType.includes('application/json')

  const {
    getEffectiveContent,
    getEffectiveMarkdownContent,
    getTableData,
    getTableCsv,
    getTableMarkdown,
    getTableJsCode,
    getTableSql,
    copyText,
    downloadText,
    handleCopy,
    handleCopyJsonAsHtml,
    handleCopyCsvFromJson,
    handleDownload,
    handleDownloadCsv,
  } = useResultsActions({
    viewMode,
    content,
    isJson,
    jmespathEnabled,
    jmespathQuery,
    jmespathMode,
    debouncedQuery,
    truncateValues,
    displayContentRef,
    tableDataRef,
    sqlResultRef,
    hiddenColumnIds,
    sqlQuery,
  })

  // Single-entry cache for the parsed JSON object. Avoids re-parsing the same
  // content string multiple times within a render cycle (e.g. once in the
  // JMESPath useMemo and again in the renderedContent useMemo).
  const parsedContentRef = useRef<{ content: string; parsed: any } | null>(null)
  const getParsedContent = useCallback((contentStr: string): any => {
    if (parsedContentRef.current?.content === contentStr) {
      return parsedContentRef.current.parsed
    }
    const parsed = JSON.parse(contentStr)
    parsedContentRef.current = { content: contentStr, parsed }
    return parsed
  }, [])

  // LRU cache for JMESPath query results (keyed by content + query + mode).
  // Prevents re-evaluating expensive queries when the user undoes/redoes.
  const jmespathCacheRef = useRef<{ content: string; query: string; mode: string; result: JmespathQueryResult }[]>([])
  const JMESPATH_CACHE_SIZE = 10

  const getCachedJmespathResult = (contentStr: string, query: string, mode: string): JmespathQueryResult | undefined => {
    const entry = jmespathCacheRef.current.find(e => e.content === contentStr && e.query === query && e.mode === mode)
    if (entry) {
      jmespathCacheRef.current = [entry, ...jmespathCacheRef.current.filter(e => e !== entry)]
      return entry.result
    }
    return undefined
  }

  const setCachedJmespathResult = (contentStr: string, query: string, mode: string, result: JmespathQueryResult) => {
    jmespathCacheRef.current = [
      { content: contentStr, query, mode, result },
      ...jmespathCacheRef.current.filter(e => !(e.content === contentStr && e.query === query && e.mode === mode)),
    ].slice(0, JMESPATH_CACHE_SIZE)
  }

  // JMESPath filtering/highlighting — only re-runs when actual inputs change.
  const { filteredContent, matchedPaths, jmespathError, jmespathNullResult } = useMemo(() => {
    if (!jmespathEnabled || !debouncedQuery.trim() || !isJson) return EMPTY_JMESPATH_RESULT
    const cached = getCachedJmespathResult(content, debouncedQuery, jmespathMode)
    if (cached) return cached
    const result = evaluateJmespathQuery(getParsedContent(content), debouncedQuery, jmespathMode)
    setCachedJmespathResult(content, debouncedQuery, jmespathMode, result)
    return result
  // getParsedContent/getCached/setCached only access refs — safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, debouncedQuery, jmespathEnabled, jmespathMode, isJson])

  // Stable refs so callbacks passed to child components or useMemo don't need
  // to be in dependency arrays when they only need the *latest* value.
  const setJmespathQueryRef = useRef(setJmespathQuery)
  setJmespathQueryRef.current = setJmespathQuery
  const jmespathQueryRef = useRef(jmespathQuery)
  jmespathQueryRef.current = jmespathQuery

  // When in filter mode, clicking a node appends to the existing expression.
  // Uses refs for query/setter so this callback only changes when filteredContent changes.
  const handleFilteredJmespathSelect = useCallback((clickedPath: string) => {
    const newQuery = buildFilteredJmespathExpression(jmespathQueryRef.current, filteredContent, clickedPath)
    setJmespathQueryRef.current(newQuery)
  // jmespathQueryRef and setJmespathQueryRef are stable refs, safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredContent])


  // Compute pre-unique content (JMESPath filtered or original)
  const preUniqueContent =
    jmespathEnabled && jmespathMode === 'filter' && filteredContent !== null ? filteredContent : content

  // Deduplicated content (null when unique filter is off or content is not an array)
  const uniqueFilteredContent = useMemo(
    () => uniqueFilter ? deduplicateJsonArray(preUniqueContent) : null,
    [uniqueFilter, preUniqueContent],
  )

  // Effective filtered content (unique filter applied on top of JMESPath filter)
  const effectiveFilteredContent =
    uniqueFilter && uniqueFilteredContent !== null ? uniqueFilteredContent : filteredContent

  // Count duplicates from the pre-unique content (unaffected by unique filter toggle)
  const duplicateCount = useMemo(() => countDuplicates(preUniqueContent), [preUniqueContent])

  // Memoized rendered content — the single most impactful optimisation.
  // Previously renderContent() was a plain function called during JSX evaluation,
  // meaning every state change (SQL input, sort order, history panel, etc.)
  // would re-run the full JMESPath highlight path including the O(n²)
  // findJmespathJsonLocations traversal. Now it only re-runs when the actual
  // inputs to the display change.
  const renderedContent = useMemo((): React.ReactNode => {
    // JMESPath filter mode (unique filter applied on top if active)
    if (jmespathEnabled && jmespathMode === 'filter' && effectiveFilteredContent !== null) {
      try {
        JSON.parse(effectiveFilteredContent)
        return (
          <JsonResponseViewer
            jsonString={effectiveFilteredContent}
            responseSchema={undefined}
            validationErrors={undefined}
            onJmespathSelect={handleFilteredJmespathSelect}
            truncateValues={truncateValues}
          />
        )
      } catch {
        return effectiveFilteredContent
      }
    }

    // Unique filter active without JMESPath filter — apply to raw content
    if (uniqueFilter && uniqueFilteredContent !== null) {
      try {
        JSON.parse(uniqueFilteredContent)
        return (
          <JsonResponseViewer
            jsonString={uniqueFilteredContent}
            responseSchema={responseSchema}
            validationErrors={validationErrors}
            onJmespathSelect={selectJmespathQuery}
            truncateValues={truncateValues}
          />
        )
      } catch {
        return uniqueFilteredContent
      }
    }

    // JMESPath highlight mode — matchedPaths already computed in the useMemo above.
    // Pass a stable-ref callback so this memo doesn't depend on setJmespathQuery identity.
    if (jmespathEnabled && jmespathMode === 'highlight' && debouncedQuery.trim() && isJson && !jmespathError) {
      try {
        const parsed = getParsedContent(content)
        return highlightJson(parsed, matchedPaths, (path) => setJmespathQueryRef.current(path))
      } catch {
        // Fall through to normal rendering
      }
    }

    if (isJson) {
      try {
        JSON.parse(content)
        return (
          <JsonResponseViewer
            jsonString={content}
            responseSchema={responseSchema}
            validationErrors={validationErrors}
            onJmespathSelect={selectJmespathQuery}
            truncateValues={truncateValues}
          />
        )
      } catch {
        return content
      }
    }

    return content
  // getParsedContent is stable (useCallback []). setJmespathQueryRef is a stable
  // ref object. Both are safe to omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    jmespathEnabled, jmespathMode, effectiveFilteredContent,
    uniqueFilter, uniqueFilteredContent,
    matchedPaths, debouncedQuery, isJson, jmespathError,
    content, responseSchema, validationErrors, truncateValues,
    handleFilteredJmespathSelect, selectJmespathQuery,
  ])

  // Calculate line count
  const displayContent =
    uniqueFilter && uniqueFilteredContent !== null
      ? uniqueFilteredContent
      : jmespathEnabled && jmespathMode === 'filter' && filteredContent !== null
        ? filteredContent
        : content
  displayContentRef.current = displayContent
  const lineCount = displayContent.split('\n').length

  // Lightweight validity checks for each view mode
  const viewValidity = useMemo(() => {
    const trimmed = displayContent.trim()
    const jsonValid = isJson || (() => { try { JSON.parse(trimmed); return true } catch { return false } })()
    const tableValid = (() => {
      if (jsonValid) {
        try {
          const parsed = JSON.parse(trimmed)
          return Array.isArray(parsed) && parsed.length > 0
        } catch { return false }
      }
      const lines = trimmed.split('\n').filter(l => l.trim())
      return lines.length >= 2 && lines[0].includes(',')
    })()
    const markdownValid = trimmed.length > 0
    return { json: jsonValid, markdown: markdownValid, table: tableValid }
  }, [displayContent, isJson])

  // Detect joining context by parsing the JMESPath expression structure.
  // Each [*] / [] traversal in the path (except the last) becomes a joining column
  // whose value is the index of the element at that traversal level.
  const joiningContext = useMemo((): JoiningContext | null => {
    if (viewMode !== 'table' || !isJson) return null
    if (!jmespathEnabled || jmespathMode !== 'filter' || !debouncedQuery.trim()) return null
    try {
      const originalParsed = JSON.parse(content)
      const displayParsed = JSON.parse(displayContent)
      if (!Array.isArray(displayParsed) || !displayParsed.length) return null
      return detectJoiningContext(originalParsed, debouncedQuery, displayParsed.length)
    } catch { return null }
  }, [content, displayContent, viewMode, isJson, jmespathEnabled, jmespathMode, debouncedQuery])

  // Candidate join columns for all joining segments (unique-valued scalar attributes)
  const joinColumnCandidates = useMemo((): JoinColumnCandidate[][] => {
    if (viewMode !== 'table' || !isJson || !jmespathEnabled || jmespathMode !== 'filter' || !debouncedQuery.trim()) return []
    if (!joiningContext) return []
    try {
      const originalParsed = JSON.parse(content)
      return detectJoinColumnCandidates(originalParsed, debouncedQuery, joiningContext)
    } catch {
      return []
    }
  }, [viewMode, isJson, jmespathEnabled, jmespathMode, debouncedQuery, content, joiningContext])

  // Auto-append [] to JMESPath when in table view and result is an array of arrays
  useEffect(() => {
    if (viewMode !== 'table' || !jmespathEnabled || jmespathMode !== 'filter' || !filteredContent) return
    try {
      const parsed = JSON.parse(filteredContent)
      if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
        const trimmed = debouncedQuery.trim()
        if (!trimmed.endsWith('[]')) {
          setJmespathQuery(trimmed + '[]')
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [viewMode, jmespathEnabled, jmespathMode, filteredContent, debouncedQuery, setJmespathQuery])

  const jsonStats = useMemo(
    () => isJson ? computeJsonStats(displayContent) : null,
    [displayContent, isJson],
  )

  const filterPercent = useMemo(
    () => jmespathEnabled && jmespathMode === 'filter' && filteredContent !== null
      ? computeFilterPercent(content, filteredContent)
      : null,
    [jmespathEnabled, jmespathMode, filteredContent, content],
  )

  const actionButtonProps = {
    viewMode,
    isJson,
    showFormatButton,
    onFormat,
    truncateValues,
    onToggleTruncateValues: toggleTruncateValues,
    uniqueFilter,
    duplicateCount,
    highlightDuplicates,
    onToggleUniqueFilter: toggleUniqueFilter,
    onHighlightDuplicatesChange: setHighlightDuplicates,
    responseSchema,
    onCopy: handleCopy,
    onCopyJsonAsHtml: handleCopyJsonAsHtml,
    onCopyCsvFromJson: handleCopyCsvFromJson,
    onGetTableMarkdown: getTableMarkdown,
    onGetTableCsv: getTableCsv,
    onGetTableJsCode: getTableJsCode,
    onGetTableSql: getTableSql,
    onCopyText: copyText,
    onDownload: handleDownload,
    onDownloadCsv: handleDownloadCsv,
    onDownloadText: downloadText,
  }

  return (
    <>
      {/* Normal view */}
      <div
        className={`bg-background rounded-lg border border-border overflow-hidden flex flex-col ${className}`}
      >
        <div className="flex items-center justify-between p-2 border-b border-border">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <ViewModeTabs
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              viewValidity={viewValidity}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowHotkeyInfo(true)}
              title="Keyboard shortcuts"
            >
              <Keyboard className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <ResultsActionButtons {...actionButtonProps} showText={false} />
            {onExpandToBottom && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onExpandToBottom}
                title="Expand to bottom panel"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {onCollapseFromBottom && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onCollapseFromBottom}
                title="Collapse to side panel"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsMaximized(true)}
              title="Maximize"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {isJson && <JMESPathInputRow
          jmespathEnabled={jmespathEnabled}
          jmespathQuery={jmespathQuery}
          jmespathMode={jmespathMode}
          jmespathError={jmespathError}
          jmespathNullResult={jmespathNullResult}
          onQueryChange={handleQueryChange}
          onQueryProgrammatic={applyQueryProgrammatic}
          onEnabledChange={setJmespathEnabledLocal}
          onModeChange={setJmespathModeLocal}
          onToggleHighlight={toggleHighlightMode}
          onToggleFilter={toggleFilterMode}
          onApplyWildcard={applyWildcard}
          onToggleTruncateValues={toggleTruncateValues}
          onToggleUniqueFilter={toggleUniqueFilter}
          undoStackRef={undoStackRef}
          redoStackRef={redoStackRef}
          typingStartRef={typingStartRef}
          undoDebounceRef={undoDebounceRef}
          jsonContent={content}
          inTableView={viewMode === 'table'}
        />}
        <div
          className="p-0 overflow-auto flex-1 outline-none"
          style={{ maxHeight }}
          tabIndex={0}
          onKeyDown={viewMode === 'json' ? (e) => handleViewerKeyDown(e, normalPreRef) : undefined}
        >
          {viewMode === 'json' && (
            <JsonViewPanel renderedContent={renderedContent} preRef={normalPreRef} padding="p-4" />
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
        />
      </div>

      {/* Maximized dialog */}
      <MaximizedViewDialog
        open={isMaximized}
        onOpenChange={setIsMaximized}
        onShowHotkeyInfo={() => setShowHotkeyInfo(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewValidity={viewValidity}
        actionButtons={<ResultsActionButtons {...actionButtonProps} showText={true} />}
        isJson={isJson}
        jmespathEnabled={jmespathEnabled}
        jmespathQuery={jmespathQuery}
        jmespathMode={jmespathMode}
        jmespathError={jmespathError}
        jmespathNullResult={jmespathNullResult}
        onQueryChange={handleQueryChange}
        onQueryProgrammatic={applyQueryProgrammatic}
        onEnabledChange={setJmespathEnabledLocal}
        onModeChange={setJmespathModeLocal}
        onToggleHighlight={toggleHighlightMode}
        onToggleFilter={toggleFilterMode}
        onApplyWildcard={applyWildcard}
        onToggleTruncateValues={toggleTruncateValues}
        onToggleUniqueFilter={toggleUniqueFilter}
        undoStackRef={undoStackRef}
        redoStackRef={redoStackRef}
        typingStartRef={typingStartRef}
        undoDebounceRef={undoDebounceRef}
        jsonContent={content}
        renderedContent={renderedContent}
        displayContent={displayContent}
        joiningContext={joiningContext}
        joinColumnCandidates={joinColumnCandidates}
        tableDataRef={tableDataRef}
        sqlResultRef={sqlResultRef}
        highlightDuplicates={highlightDuplicates}
        onViewerKeyDown={handleViewerKeyDown}
        jsonStats={jsonStats}
        duplicateCount={duplicateCount}
        lineCount={lineCount}
        filterPercent={filterPercent}
      />

      <HotkeyInfoDialog open={showHotkeyInfo} onOpenChange={setShowHotkeyInfo} />
    </>
  )
}
