import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { HotkeyInfoDialog } from './HotkeyInfoDialog'
import { JsonViewPanel } from './JsonViewPanel'
import { JMESPathInputRow } from './JMESPathInputRow'
import { MarkdownViewPanel } from './MarkdownViewPanel'
import { TableViewPanel } from './TableViewPanel'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import jmespath from 'jmespath'
import {
  AlignLeft,
  ArrowLeftRight,
  BookOpen,
  Code,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Keyboard,
  Maximize2,
  Minimize2,
  WrapText,
} from 'lucide-react'
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { JsonResponseViewer } from './JsonResponseViewer'
import { applyTruncationToJson, jsonToStyledHtml, writeTextToClipboard, writeHtmlToClipboard } from './json-copy-utils'
import { deepEqual, detectJoiningContext, detectJoinColumnCandidates, type JoiningContext, type JoinColumnCandidate } from './joining-utils'
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

/**
 * Stage 1: Find JSON paths in `original` that correspond to the JMESPath `result`.
 * Returns a Set of path strings (e.g. "hits[0].document.name") to highlight.
 */
function findJmespathJsonLocations(original: any, result: any, query: string): Set<string> {
  const matchedPaths = new Set<string>()

  const addPathAndChildren = (obj: any, currentPath: string): void => {
    matchedPaths.add(currentPath)
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
          addPathAndChildren(item, currentPath ? `${currentPath}[${idx}]` : `[${idx}]`)
        })
      } else {
        Object.keys(obj).forEach((key) => {
          addPathAndChildren(obj[key], currentPath ? `${currentPath}.${key}` : key)
        })
      }
    }
  }

  // Fast-path for simple field-access queries (no wildcards or functions)
  const simplePathRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[\d+\])*$/
  if (simplePathRegex.test(query.trim())) {
    const path = query.trim()
    const pathParts = path.match(/[a-zA-Z_$][a-zA-Z0-9_$]*|\[\d+\]/g) || []
    let current = original
    let valid = true

    for (const part of pathParts) {
      if (part.startsWith('[')) {
        const index = parseInt(part.slice(1, -1), 10)
        if (Array.isArray(current) && index >= 0 && index < current.length) {
          current = current[index]
        } else {
          valid = false
          break
        }
      } else {
        if (current && typeof current === 'object' && part in current) {
          current = current[part]
        } else {
          valid = false
          break
        }
      }
    }

    if (valid && deepEqual(current, result)) {
      addPathAndChildren(current, path)
      return matchedPaths
    }
  }

  // Slow-path for complex queries: structural containment matching
  const isInResult = (value: any, res: any, checkPartial: boolean = true): boolean => {
    if (deepEqual(value, res)) return true
    if (!checkPartial) return false
    if (Array.isArray(res)) {
      return res.some((item) => isInResult(value, item, true))
    }
    if (res && typeof res === 'object' && !Array.isArray(res)) {
      return Object.values(res).some((v) => isInResult(value, v, true))
    }
    return false
  }

  const traverse = (obj: any, currentPath: string): void => {
    if (isInResult(obj, result, true)) {
      matchedPaths.add(currentPath)
    }
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
          traverse(item, currentPath ? `${currentPath}[${idx}]` : `[${idx}]`)
        })
      } else {
        Object.keys(obj).forEach((key) => {
          traverse(obj[key], currentPath ? `${currentPath}.${key}` : key)
        })
      }
    }
  }

  traverse(original, '')
  return matchedPaths
}

/**
 * Stage 2: Render JSON with highlighting applied to matched paths.
 * `onClickPath` is called (instead of closing over a setState) so this
 * function can live at module level with a stable reference.
 */
function highlightJson(parsed: any, matchedPaths: Set<string>, onClickPath: (path: string) => void): React.ReactNode {
  const handleClick = (path: string) => (e: React.MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && path) {
      e.preventDefault()
      onClickPath(path)
    }
  }

  const renderValue = (value: any, currentPath: string, indent: number = 0): React.ReactNode => {
    const indentStr = '  '.repeat(indent)
    const isHighlighted = matchedPaths.has(currentPath)
    const className = isHighlighted ? 'text-primary font-semibold' : 'text-muted-foreground/50'
    const clickTitle = 'Cmd/Ctrl+click to use as JMESPath'

    if (value === null) {
      return <span className={`${className} cursor-pointer`} onClick={handleClick(currentPath)} title={clickTitle}>null</span>
    }

    if (typeof value === 'boolean') {
      return <span className={`${className} cursor-pointer`} onClick={handleClick(currentPath)} title={clickTitle}>{String(value)}</span>
    }

    if (typeof value === 'number') {
      return <span className={`${className} cursor-pointer`} onClick={handleClick(currentPath)} title={clickTitle}>{value}</span>
    }

    if (typeof value === 'string') {
      return <span className={`${className} cursor-pointer`} onClick={handleClick(currentPath)} title={clickTitle}>"{value}"</span>
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-muted-foreground/50">[]</span>
      return (
        <>
          <span className="text-muted-foreground/50">[</span>
          {'\n'}
          {value.map((item, idx) => {
            const itemPath = currentPath ? `${currentPath}[${idx}]` : `[${idx}]`
            return (
              <React.Fragment key={idx}>
                {indentStr}
                {'  '}
                {renderValue(item, itemPath, indent + 1)}
                {idx < value.length - 1 && <span className="text-muted-foreground/50">,</span>}
                {'\n'}
              </React.Fragment>
            )
          })}
          {indentStr}
          <span className="text-muted-foreground/50">]</span>
        </>
      )
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value)
      if (keys.length === 0) return <span className="text-muted-foreground/50">{'{}'}</span>
      return (
        <>
          <span className="text-muted-foreground/50">{'{'}</span>
          {'\n'}
          {keys.map((key, idx) => {
            const keyPath = currentPath ? `${currentPath}.${key}` : key
            return (
              <React.Fragment key={key}>
                {indentStr}
                {'  '}
                <span className="text-muted-foreground/50 cursor-pointer" onClick={handleClick(keyPath)} title={clickTitle}>"{key}"</span>
                <span className="text-muted-foreground/50">: </span>
                {renderValue(value[key], keyPath, indent + 1)}
                {idx < keys.length - 1 && <span className="text-muted-foreground/50">,</span>}
                {'\n'}
              </React.Fragment>
            )
          })}
          {indentStr}
          <span className="text-muted-foreground/50">{'}'}</span>
        </>
      )
    }

    return String(value)
  }

  return renderValue(parsed, '', 0)
}

export type { JMESPathState } from './JMESPathInputRow'

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
  const dialogPreRef = useRef<HTMLPreElement>(null)
  const dialogContentRef = useRef<HTMLDivElement>(null)

  // Auto-focus the maximized dialog content area so hotkeys work immediately
  useEffect(() => {
    if (isMaximized) {
      // Small delay to let the dialog render
      requestAnimationFrame(() => {
        dialogContentRef.current?.focus()
      })
    }
  }, [isMaximized])

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
    if (prev !== newValue) {
      undoStackRef.current = [...undoStackRef.current, prev].slice(-100)
      redoStackRef.current = []
    }
    setJmespathQuery(newValue)
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

  // Get effective content (filtered if JMESPath filter is active)
  const getEffectiveContent = () => {
    if (jmespathEnabled && jmespathMode === 'filter' && debouncedQuery.trim() && isJson) {
      try {
        const parsed = JSON.parse(content)
        const result = jmespath.search(parsed, debouncedQuery)
        return JSON.stringify(result, null, 2)
      } catch {
        return content
      }
    }
    return content
  }

  // Resolve effective markdown content (converts JSON arrays to markdown tables)
  const getEffectiveMarkdownContent = (): string | null => {
    const effective = getEffectiveContent()
    let mdContent = effective
    try {
      const parsed = JSON.parse(effective)
      if (typeof parsed === 'string') {
        mdContent = parsed
      } else if (Array.isArray(parsed) && parsed.length > 0) {
        // Array of strings → join with horizontal rule separators
        if (parsed.every((item: any) => typeof item === 'string')) {
          mdContent = parsed.join('\n\n---\n\n')
        } else if (typeof parsed[0] === 'object' && parsed[0] !== null && !Array.isArray(parsed[0])) {
          const columns = Array.from(new Set(parsed.flatMap((item: any) => Object.keys(item))))
          const escapeCell = (val: any) => {
            const str = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
            return str.replace(/\|/g, '\\|').replace(/\n/g, ' ')
          }
          const headerRow = `| ${columns.join(' | ')} |`
          const separatorRow = `| ${columns.map(() => '---').join(' | ')} |`
          const dataRows = parsed.map((item: any) =>
            `| ${columns.map((col) => escapeCell(item[col])).join(' | ')} |`
          )
          mdContent = [headerRow, separatorRow, ...dataRows].join('\n')
        } else {
          const escapeCell = (val: any) => {
            const str = val === null || val === undefined ? '' : String(val)
            return str.replace(/\|/g, '\\|').replace(/\n/g, ' ')
          }
          mdContent = ['| value |', '| --- |', ...parsed.map((v: any) => `| ${escapeCell(v)} |`)].join('\n')
        }
      } else {
        return null
      }
    } catch {
      // Not JSON — use as-is
    }
    return mdContent
  }

  const getTableData = () => {
    const raw = sqlResultRef.current || (tableDataRef.current ? { columns: tableDataRef.current.columns, rows: tableDataRef.current.rows } : null)
    if (!raw || hiddenColumnIds.size === 0) return raw
    const visibleIndices = raw.columns.map((c, i) => ({ c, i })).filter(({ c }) => !hiddenColumnIds.has(c)).map(({ i }) => i)
    return {
      columns: visibleIndices.map(i => raw.columns[i]),
      rows: raw.rows.map(row => visibleIndices.map(i => row[i])),
    }
  }

  const getTableTsv = () => {
    const data = getTableData()
    if (!data) return null
    return [data.columns.join('\t'), ...data.rows.map(row => row.join('\t'))].join('\n')
  }

  const handleCopy = () => {
    if (viewMode === 'table') {
      const tsv = getTableTsv()
      if (!tsv) { toast.error('No table data to copy'); return }
      const data = getTableData()!
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const headerCells = data.columns.map(c => `<th>${esc(c)}</th>`).join('')
      const bodyRows = data.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')
      const htmlTable = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
      const blob = new Blob([htmlTable], { type: 'text/html' })
      const textBlob = new Blob([tsv], { type: 'text/plain' })
      writeHtmlToClipboard(htmlTable, tsv).then(
        () => toast.success('Copied table to clipboard'),
        () => toast.error('Failed to copy — check browser clipboard permissions'),
      )
      return
    }
    if (viewMode === 'markdown') {
      const md = getEffectiveMarkdownContent()
      if (md) {
        copyText(md, 'Markdown')
        return
      }
    }
    // JSON / plain text — use displayContentRef which respects all active filters
    const jsonContent = truncateValues
      ? applyTruncationToJson(displayContentRef.current)
      : displayContentRef.current
    writeTextToClipboard(jsonContent).then(
      () => toast.success(
        jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim()
          ? 'Copied filtered content to clipboard'
          : 'Copied to clipboard',
      ),
      () => toast.error('Failed to copy — check browser clipboard permissions'),
    )
  }

  const handleCopyJsonAsHtml = () => {
    const jsonContent = truncateValues
      ? applyTruncationToJson(displayContentRef.current)
      : displayContentRef.current
    const html = jsonToStyledHtml(jsonContent)
    writeHtmlToClipboard(html, jsonContent).then(
      () => toast.success('Copied as HTML with syntax highlighting'),
      () => toast.error('Failed to copy — check browser clipboard permissions'),
    )
  }

  const getTableCsv = () => {
    const data = getTableData()
    if (!data) return null
    const escape = (val: string) => {
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val
    }
    return [data.columns.map(escape).join(','), ...data.rows.map(row => row.map(escape).join(','))].join('\n')
  }

  const getTableMarkdown = () => {
    const data = getTableData()
    if (!data) return null
    const esc = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ')
    return [
      `| ${data.columns.map(esc).join(' | ')} |`,
      `| ${data.columns.map(() => '---').join(' | ')} |`,
      ...data.rows.map(row => `| ${row.map(esc).join(' | ')} |`),
    ].join('\n')
  }

  const getTableJsCode = () => {
    const data = getTableData()
    if (!data) return null
    const objects = data.rows.map(row => {
      const obj: Record<string, string> = {}
      data.columns.forEach((col, i) => { obj[col] = row[i] })
      return obj
    })
    return JSON.stringify(objects, null, 2)
  }

  const getTableSql = (tableName = 'table_name') => {
    const data = getTableData()
    if (!data) return null
    const escSql = (v: string) => v.replace(/'/g, "''")
    const cols = data.columns.map(c => `"${c}"`).join(', ')
    return data.rows.map(row => {
      const vals = row.map(v => v === '' ? 'NULL' : `'${escSql(v)}'`).join(', ')
      return `INSERT INTO ${tableName} (${cols}) VALUES (${vals});`
    }).join('\n')
  }

  const copyText = (text: string, label: string) => {
    writeTextToClipboard(text).then(
      () => toast.success(`Copied as ${label}`),
      () => toast.error('Failed to copy — check browser clipboard permissions'),
    )
  }

  const downloadText = (text: string, filename: string, mimeType: string, label: string) => {
    const blob = new Blob([text], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Downloaded as ${label}`)
  }

  const handleDownload = () => {
    if (viewMode === 'table') {
      const csv = getTableCsv()
      if (!csv) { toast.error('No table data to download'); return }
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = sqlQuery.trim() ? 'response-filtered.csv' : 'response.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Downloaded as CSV')
      return
    }
    if (viewMode === 'markdown') {
      const mdContent = getEffectiveMarkdownContent() || getEffectiveContent()
      const blob = new Blob([mdContent], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'response.md'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Downloaded as Markdown')
      return
    }
    const effectiveContent = getEffectiveContent()
    const extension = isJson ? 'json' : 'txt'
    const mimeType = isJson ? 'application/json' : 'text/plain'
    const blob = new Blob([effectiveContent], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download =
      jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim()
        ? `response-filtered.${extension}`
        : `response.${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(
      jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim()
        ? 'Downloaded filtered response'
        : 'Downloaded response',
    )
  }

  const handleDownloadCsv = () => {
    const effectiveContent = getEffectiveContent()
    let csvContent = ''
    try {
      const parsed = JSON.parse(effectiveContent)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'object' && parsed[0] !== null && !Array.isArray(parsed[0])) {
          // Array of objects: use keys as headers
          const keys = Array.from(new Set(parsed.flatMap((item: any) => Object.keys(item))))
          const escape = (val: any) => {
            const str = val === null || val === undefined ? '' : String(val)
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str
          }
          csvContent = [keys.map(escape).join(','), ...parsed.map((row: any) => keys.map((k) => escape(row[k])).join(','))].join('\n')
        } else {
          // Array of primitives: single column
          const escape = (val: any) => {
            const str = val === null || val === undefined ? '' : String(val)
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str
          }
          csvContent = ['value', ...parsed.map(escape)].join('\n')
        }
      } else {
        toast.error('CSV export requires a JSON array')
        return
      }
    } catch {
      toast.error('Failed to parse JSON for CSV export')
      return
    }
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download =
      jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim()
        ? 'response-filtered.csv'
        : 'response.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Downloaded as CSV')
  }

  const handleCopyCsvFromJson = () => {
    const effectiveContent = getEffectiveContent()
    try {
      const parsed = JSON.parse(effectiveContent)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        toast.error('CSV export requires a JSON array')
        return
      }
      const escape = (val: any) => {
        const str = val === null || val === undefined ? '' : String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }
      let csvContent: string
      if (typeof parsed[0] === 'object' && parsed[0] !== null && !Array.isArray(parsed[0])) {
        const keys = Array.from(new Set(parsed.flatMap((item: any) => Object.keys(item)))) as string[]
        csvContent = [keys.map(escape).join(','), ...parsed.map((row: any) => keys.map((k) => escape(row[k])).join(','))].join('\n')
      } else {
        csvContent = ['value', ...parsed.map(escape)].join('\n')
      }
      copyText(csvContent, 'CSV')
    } catch {
      toast.error('Failed to parse JSON for CSV export')
    }
  }

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

  // LRU cache for JMESPath search results. Key is the content string itself
  // (not its length) to avoid collisions between responses of the same size.
  const jmespathCacheRef = useRef<{ content: string; query: string; result: any }[]>([])
  const JMESPATH_CACHE_SIZE = 10

  const getCachedJmespathResult = (contentStr: string, query: string): any | undefined => {
    const entry = jmespathCacheRef.current.find(e => e.content === contentStr && e.query === query)
    if (entry) {
      // Move to front (most recently used)
      jmespathCacheRef.current = [entry, ...jmespathCacheRef.current.filter(e => e !== entry)]
      return entry.result
    }
    return undefined
  }

  const setCachedJmespathResult = (contentStr: string, query: string, result: any) => {
    jmespathCacheRef.current = [
      { content: contentStr, query, result },
      ...jmespathCacheRef.current.filter(e => !(e.content === contentStr && e.query === query)),
    ].slice(0, JMESPATH_CACHE_SIZE)
  }

  // JMESPath filtering/highlighting logic — all expensive computation lives here
  // so it only re-runs when the actual inputs change (not on every render).
  const { filteredContent, matchedPaths, jmespathError, jmespathNullResult } = useMemo(() => {
    if (!jmespathEnabled || !debouncedQuery.trim() || !isJson) {
      return { filteredContent: null, matchedPaths: new Set<string>(), jmespathError: null, jmespathNullResult: false }
    }

    try {
      // Use the parse cache so we don't re-parse the same string twice
      const parsed = getParsedContent(content)

      let result = getCachedJmespathResult(content, debouncedQuery)
      if (result === undefined) {
        result = jmespath.search(parsed, debouncedQuery)
        setCachedJmespathResult(content, debouncedQuery, result)
      }

      const isNull = result === null

      if (jmespathMode === 'filter') {
        return {
          filteredContent: JSON.stringify(result, null, 2),
          matchedPaths: new Set<string>(),
          jmespathError: null,
          jmespathNullResult: isNull,
        }
      }

      // Highlight mode: compute the full matched-path set here so it is
      // memoized and not recomputed on every unrelated render.
      const paths = findJmespathJsonLocations(parsed, result, debouncedQuery)
      return { filteredContent: null, matchedPaths: paths, jmespathError: null, jmespathNullResult: isNull }
    } catch (e: unknown) {
      return {
        filteredContent: null,
        matchedPaths: new Set<string>(),
        jmespathError: e instanceof Error ? e.message : 'Invalid JMESPath query',
        jmespathNullResult: false,
      }
    }
  // getParsedContent is stable (useCallback with []) so omitting from deps is safe.
  // getCached/setCached only access a ref, also safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, debouncedQuery, jmespathEnabled, jmespathMode, isJson])

  // Stable refs so callbacks passed to child components or useMemo don't need
  // to be in dependency arrays when they only need the *latest* value.
  const setJmespathQueryRef = useRef(setJmespathQuery)
  setJmespathQueryRef.current = setJmespathQuery
  const jmespathQueryRef = useRef(jmespathQuery)
  jmespathQueryRef.current = jmespathQuery

  // When in filter mode, clicking a node should append to the existing expression
  // rather than replace it. If the current filtered result is an array, clicking a
  // key appends `[].key`; if it's an object, it appends `.key`.
  // Uses refs for query/setter so this callback only changes when filteredContent changes.
  const handleFilteredJmespathSelect = useCallback((clickedPath: string) => {
    const currentQuery = jmespathQueryRef.current
    if (!currentQuery.trim() || filteredContent === null) {
      setJmespathQueryRef.current(clickedPath)
      return
    }

    try {
      const parsed = JSON.parse(filteredContent)
      if (Array.isArray(parsed)) {
        // Strip leading [number] or [number]. prefix and use [] wildcard instead
        if (/^\[\d+\]$/.test(clickedPath)) {
          // Clicking directly on an array element (no sub-path) — pipe to that index
          setJmespathQueryRef.current(`${currentQuery} | ${clickedPath}`)
        } else {
          // Clicking a property within an array element — wildcard projection
          const stripped = clickedPath.replace(/^\[\d+\]\.?/, '')
          const suffix = stripped
            ? stripped.startsWith('[') ? `[]${stripped}` : `[].${stripped}`
            : '[]'
          setJmespathQueryRef.current(`${currentQuery}${suffix}`)
        }
      } else {
        // Object: append with dot separator (or nothing if path starts with '[')
        const separator = clickedPath.startsWith('[') ? '' : '.'
        setJmespathQueryRef.current(`${currentQuery}${separator}${clickedPath}`)
      }
    } catch {
      setJmespathQueryRef.current(clickedPath)
    }
  // jmespathQueryRef and setJmespathQueryRef are stable refs, safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredContent])


  // Compute pre-unique content (JMESPath filtered or original)
  const preUniqueContent =
    jmespathEnabled && jmespathMode === 'filter' && filteredContent !== null ? filteredContent : content

  // Deduplicated content (null when unique filter is off or content is not an array)
  const uniqueFilteredContent = useMemo(() => {
    if (!uniqueFilter) return null
    try {
      const parsed = JSON.parse(preUniqueContent)
      if (!Array.isArray(parsed)) return null
      const seen = new Set<string>()
      const unique = parsed.filter((item) => {
        const key = JSON.stringify(item)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      return JSON.stringify(unique, null, 2)
    } catch {
      return null
    }
  }, [uniqueFilter, preUniqueContent])

  // Effective filtered content (unique filter applied on top of JMESPath filter)
  const effectiveFilteredContent =
    uniqueFilter && uniqueFilteredContent !== null ? uniqueFilteredContent : filteredContent

  // Count duplicates from the pre-unique content (unaffected by unique filter toggle)
  const duplicateCount = useMemo(() => {
    try {
      const parsed = JSON.parse(preUniqueContent)
      if (!Array.isArray(parsed)) return 0
      const seen = new Set<string>()
      let dupes = 0
      for (const item of parsed) {
        const key = JSON.stringify(item)
        if (seen.has(key)) dupes++
        else seen.add(key)
      }
      return dupes
    } catch {
      return 0
    }
  }, [preUniqueContent])

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

  // viewModeTabs is defined after displayContent below

  const schemaButton = (showText: boolean = false) =>
    responseSchema && (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
            title="Schema"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {showText && <span>Schema</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] max-w-[90vw] p-0" align="end" side="bottom">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Response Schema</span>
          </div>
          <ScrollArea className="h-[400px]">
            <div className="p-3">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                {JSON.stringify(responseSchema, null, 2)}
              </pre>
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    )

  const actionButtons = (showText: boolean = false) => (
    <>
      {showFormatButton && onFormat && (
        <Button
          variant="outline"
          size="sm"
          className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
          onClick={onFormat}
          title="Format"
        >
          <AlignLeft className="h-3.5 w-3.5" />
          {showText && <span>Format</span>}
        </Button>
      )}
      {isJson && (
        <Button
          variant={truncateValues ? 'default' : 'outline'}
          size="sm"
          className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
          onClick={toggleTruncateValues}
          title="Toggle value truncation (⌘I)"
        >
          <WrapText className="h-3.5 w-3.5" />
          {showText && <span>Truncate</span>}
        </Button>
      )}
      {isJson && (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Button
              variant={uniqueFilter && duplicateCount > 0 ? 'destructive' : (uniqueFilter || highlightDuplicates) ? 'default' : 'outline'}
              size="sm"
              className={`${showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}${highlightDuplicates && !uniqueFilter ? ' border-amber-500 text-amber-500' : ''}`}
              onClick={toggleUniqueFilter}
              title="Filter duplicate values (⌘U) — right-click for more options"
            >
              <Fingerprint className="h-3.5 w-3.5" />
              {showText && <span>Unique</span>}
            </Button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={toggleUniqueFilter}>
              {uniqueFilter ? 'Show all (remove filter)' : 'Filter out duplicates'}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem
              checked={highlightDuplicates}
              onCheckedChange={setHighlightDuplicates}
            >
              Highlight duplicates
            </ContextMenuCheckboxItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
      {schemaButton(showText)}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
            onClick={handleCopy}
            title="Copy (right-click for more options)"
          >
            <Copy className="h-3.5 w-3.5" />
            {showText && <span>Copy</span>}
          </Button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {viewMode === 'json' && (
            <>
              <ContextMenuItem onClick={handleCopy}>Copy JSON</ContextMenuItem>
              <ContextMenuItem onClick={handleCopyJsonAsHtml}>Copy as HTML (with colors)</ContextMenuItem>
            </>
          )}
          {viewMode === 'table' && (
            <>
              <ContextMenuItem onClick={handleCopy}>Copy as Table (Excel/Email)</ContextMenuItem>
              <ContextMenuItem onClick={() => { const md = getTableMarkdown(); if (md) copyText(md, 'Markdown'); else toast.error('No table data to copy') }}>Copy as Markdown</ContextMenuItem>
              <ContextMenuItem onClick={() => { const csv = getTableCsv(); if (csv) copyText(csv, 'CSV'); else toast.error('No table data to copy') }}>Copy as CSV</ContextMenuItem>
              <ContextMenuItem onClick={() => { const js = getTableJsCode(); if (js) copyText(js, 'Code'); else toast.error('No table data to copy') }}>Copy as Code</ContextMenuItem>
              <ContextMenuItem onClick={() => { const sql = getTableSql(); if (sql) copyText(sql, 'SQL'); else toast.error('No table data to copy') }}>Copy as SQL</ContextMenuItem>
            </>
          )}
          {viewMode === 'markdown' && (
            <ContextMenuItem onClick={handleCopy}>Copy Markdown</ContextMenuItem>
          )}
          {viewMode !== 'table' && viewMode !== 'json' && isJson && (
            <ContextMenuItem onClick={handleCopyCsvFromJson}>Copy as CSV</ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
            onClick={handleDownload}
            title="Download (right-click for more options)"
          >
            <Download className="h-3.5 w-3.5" />
            {showText && <span>Download</span>}
          </Button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleDownload}>
            {viewMode === 'table' ? 'Download as CSV' : viewMode === 'markdown' ? 'Download as Markdown' : 'Download as JSON'}
          </ContextMenuItem>
          {viewMode === 'table' && (
            <>
              <ContextMenuItem onClick={() => { const md = getTableMarkdown(); if (md) downloadText(md, 'response.md', 'text/markdown', 'Markdown') }}>
                Download as Markdown
              </ContextMenuItem>
              <ContextMenuItem onClick={() => { const js = getTableJsCode(); if (js) downloadText(js, 'response.json', 'application/json', 'JSON') }}>
                Download as JSON
              </ContextMenuItem>
              <ContextMenuItem onClick={() => { const sql = getTableSql(); if (sql) downloadText(sql, 'response.sql', 'text/plain', 'SQL') }}>
                Download as SQL
              </ContextMenuItem>
            </>
          )}
          {viewMode !== 'table' && isJson && (
            <ContextMenuItem onClick={handleDownloadCsv}>
              Download as CSV
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </>
  )

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

  const viewModeOptions: { value: ViewMode; label: string; icon: React.ReactNode; valid: boolean }[] = [
    { value: 'json', label: 'JSON', icon: <Code className="h-3 w-3" />, valid: viewValidity.json },
    { value: 'markdown', label: 'Markdown', icon: <FileText className="h-3 w-3" />, valid: viewValidity.markdown },
    { value: 'table', label: 'Table', icon: <FileSpreadsheet className="h-3 w-3" />, valid: viewValidity.table },
  ]

  const viewModeTabs = () => (
    <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
      <SelectTrigger className="h-6 w-auto gap-1.5 px-2 text-xs border-none bg-transparent hover:bg-accent focus:ring-0 focus:ring-offset-0 [&>svg:last-child]:h-3 [&>svg:last-child]:w-3 [&>svg:last-child]:opacity-50">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {viewModeOptions.map(opt => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            <div className="flex items-center gap-2">
              <span className={opt.valid ? 'text-foreground' : 'text-muted-foreground/50'}>{opt.icon}</span>
              <span className={opt.valid ? 'text-foreground' : 'text-muted-foreground/50'}>{opt.label}</span>
              {opt.valid && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary ml-1" />
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

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

  const jsonStats = useMemo(() => {
    if (!isJson) return null
    try {
      const parsed = JSON.parse(displayContent)
      const getMaxDepth = (val: any): number => {
        if (typeof val !== 'object' || val === null) return 0
        const children = Array.isArray(val) ? val : Object.values(val)
        if (children.length === 0) return 1
        return 1 + Math.max(...children.map(getMaxDepth))
      }
      const countTotalKeys = (val: any): number => {
        if (typeof val !== 'object' || val === null) return 0
        if (Array.isArray(val)) return val.reduce((sum, item) => sum + countTotalKeys(item), 0)
        const keys = Object.keys(val)
        return keys.length + keys.reduce((sum, key) => sum + countTotalKeys(val[key]), 0)
      }
      if (Array.isArray(parsed)) {
        return { type: 'array' as const, count: parsed.length, totalKeys: countTotalKeys(parsed) }
      }
      if (typeof parsed === 'object') {
        return {
          type: 'object' as const,
          keys: Object.keys(parsed).length,
          totalKeys: countTotalKeys(parsed),
          depth: getMaxDepth(parsed),
        }
      }
      return null
    } catch {
      return null
    }
  }, [displayContent, isJson])

  // Percentage of original response currently displayed (only meaningful when JMESPath filter is active).
  // Both sides are compacted to the same format so whitespace differences don't skew the ratio.
  const filterPercent = useMemo(() => {
    if (!jmespathEnabled || jmespathMode !== 'filter' || filteredContent === null) return null
    try {
      const originalCompact = JSON.stringify(JSON.parse(content))
      const filteredCompact = JSON.stringify(JSON.parse(filteredContent))
      if (originalCompact.length === 0) return null
      return Math.round((filteredCompact.length / originalCompact.length) * 1000) / 10
    } catch {
      return null
    }
  }, [jmespathEnabled, jmespathMode, filteredContent, content])

  return (
    <>
      {/* Normal view */}
      <div
        className={`bg-background rounded-lg border border-border overflow-hidden flex flex-col ${className}`}
      >
        <div className="flex items-center justify-between p-2 border-b border-border">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {viewModeTabs()}
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
            {actionButtons(false)}
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
        {/* Status ribbon */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <div>{jmespathError && <span className="text-destructive">{jmespathError}</span>}</div>
          <div className="flex items-center gap-4">
            {viewMode === 'json' && <>
              {jsonStats?.type === 'array' && <span>{jsonStats.count.toLocaleString()} items</span>}
              {duplicateCount > 0 && <span className="text-red-400">{duplicateCount} duplicates</span>}
              {jsonStats && jsonStats.totalKeys > 0 && <span>{jsonStats.totalKeys.toLocaleString()} total keys</span>}
              {jsonStats?.type === 'object' && <>
                <span>{jsonStats.keys.toLocaleString()} keys</span>
                <span>depth {jsonStats.depth}</span>
              </>}
              <span>Ln {lineCount.toLocaleString()}</span>
              <span>{displayContent.length.toLocaleString()} chars</span>
              {filterPercent !== null && <span className="text-primary">{filterPercent}% of response</span>}
            </>}
            {viewMode === 'markdown' && <>
              <span>Ln {lineCount.toLocaleString()}</span>
              <span>{displayContent.length.toLocaleString()} chars</span>
            </>}
            {/* table stats are shown inside TableViewPanel */}
          </div>
        </div>
      </div>

      {/* Maximized dialog */}
      <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-2">
                {viewModeTabs()}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowHotkeyInfo(true)}
                  title="Keyboard shortcuts"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                </Button>
              </DialogTitle>
              <div className="flex items-center gap-2">
                {actionButtons(true)}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setIsMaximized(false)}
                  title="Minimize"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </DialogHeader>
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
          />}
          <div
            ref={dialogContentRef}
            className="flex-1 overflow-auto p-0 outline-none"
            tabIndex={0}
            onKeyDown={viewMode === 'json' ? (e) => handleViewerKeyDown(e, dialogPreRef) : undefined}
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
          {/* Status ribbon in maximized view */}
          <div className="flex items-center justify-between px-6 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
            <div>{jmespathError && <span className="text-destructive">{jmespathError}</span>}</div>
            <div className="flex items-center gap-4">
              {viewMode === 'json' && <>
                {jsonStats?.type === 'array' && <span>{jsonStats.count.toLocaleString()} items</span>}
                {duplicateCount > 0 && <span className="text-red-400">{duplicateCount} duplicates</span>}
                {jsonStats && jsonStats.totalKeys > 0 && <span>{jsonStats.totalKeys.toLocaleString()} total keys</span>}
                {jsonStats?.type === 'object' && <>
                  <span>{jsonStats.keys.toLocaleString()} keys</span>
                  <span>depth {jsonStats.depth}</span>
                </>}
                <span>Ln {lineCount.toLocaleString()}</span>
                <span>{displayContent.length.toLocaleString()} chars</span>
                {filterPercent !== null && <span className="text-primary">{filterPercent}% of response</span>}
              </>}
              {viewMode === 'markdown' && <>
                <span>Ln {lineCount.toLocaleString()}</span>
                <span>{displayContent.length.toLocaleString()} chars</span>
              </>}
              {/* table stats are shown inside TableViewPanel */}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <HotkeyInfoDialog open={showHotkeyInfo} onOpenChange={setShowHotkeyInfo} />
    </>
  )
}
