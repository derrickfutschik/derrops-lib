import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { HotkeyInfoDialog } from './HotkeyInfoDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import alasql from 'alasql'
import jmespath from 'jmespath'
import {
  AlignLeft,
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Code,
  Copy,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  EyeOff,
  Filter,
  Fingerprint,
  Highlighter,
  Keyboard,
  Maximize2,
  Minimize2,
  WrapText,
} from 'lucide-react'
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { JsonResponseViewer } from './JsonResponseViewer'
import { deepEqual, detectJoiningContext, type JoiningContext } from './joining-utils'

// ---------------------------------------------------------------------------
// Module-level pure helpers (stable references, never recreated per render)
// ---------------------------------------------------------------------------

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

type ViewMode = 'json' | 'markdown' | 'table'

class MarkdownErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Failed to render Markdown. The content may not be valid Markdown.
        </div>
      )
    }
    return this.props.children
  }
}

export interface JMESPathState {
  enabled: boolean
  query: string
  mode: 'filter' | 'highlight'
}

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
  const [isMaximized, setIsMaximized] = useState(false)
  const [showHotkeyInfo, setShowHotkeyInfo] = useState(false)
  const [truncateValues, setTruncateValues] = useState(false)
  const [uniqueFilter, setUniqueFilter] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('json')
  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [sqlQuery, setSqlQuery] = useState<string>('')
  const [sqlMode, setSqlMode] = useState<'filter' | 'highlight'>('filter')
  const [sqlError, setSqlError] = useState<string | null>(null)
  const [sqlHistory, setSqlHistory] = useState<string[]>([])
  const [sqlHistoryIndex, setSqlHistoryIndex] = useState(-1)
  const [showSqlHistory, setShowSqlHistory] = useState(false)
  const [joiningEnabled, setJoiningEnabled] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  const hiddenColumnsRef = useRef<Set<string>>(new Set())
  const savedSqlRef = useRef('')
  const sqlInputRef = useRef<HTMLInputElement>(null)
  const tableDataRef = useRef<{ columns: string[]; rows: string[][] } | null>(null)
  const sqlResultRef = useRef<{ columns: string[]; rows: string[][] } | null>(null)
  const normalInputRef = useRef<HTMLInputElement>(null)
  const dialogInputRef = useRef<HTMLInputElement>(null)
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

  // Use controlled state if provided, otherwise use internal state
  const [internalJmespathEnabled, setInternalJmespathEnabled] = useState(false)
  const [internalJmespathQuery, setInternalJmespathQuery] = useState('')
  const [internalJmespathMode, setInternalJmespathMode] = useState<'filter' | 'highlight'>('filter')

  const [jmespathHistory, setJmespathHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showHistory, setShowHistory] = useState(false)
  const isInputFocusedRef = useRef(false)
  const savedQueryRef = useRef('')
  const prevQueryRef = useRef('')
  const activeInputRef = useRef<HTMLInputElement | null>(null)
  const savedPreWildcardRef = useRef<string | null>(null)
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])
  const typingStartRef = useRef<string | null>(null)
  const undoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const jmespathEnabled = jmespathState?.enabled ?? internalJmespathEnabled
  const jmespathQuery = jmespathState?.query ?? internalJmespathQuery
  const jmespathMode = jmespathState?.mode ?? internalJmespathMode

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

  const setJmespathEnabled = (enabled: boolean) => {
    if (onJMESPathStateChange) {
      onJMESPathStateChange({ enabled, query: jmespathQuery, mode: jmespathMode })
    } else {
      setInternalJmespathEnabled(enabled)
    }
  }

  const setJmespathQuery = useCallback((query: string) => {
    if (onJMESPathStateChange) {
      onJMESPathStateChange({ enabled: jmespathEnabled, query, mode: jmespathMode })
    } else {
      setInternalJmespathQuery(query)
    }
  }, [onJMESPathStateChange, jmespathEnabled, jmespathMode])

  // Sets query AND enables JMESPath (used for Cmd+Click from JSON viewer)
  const selectJmespathQuery = useCallback((query: string) => {
    if (onJMESPathStateChange) {
      onJMESPathStateChange({ enabled: true, query, mode: jmespathMode })
    } else {
      setInternalJmespathEnabled(true)
      setInternalJmespathQuery(query)
    }
  }, [onJMESPathStateChange, jmespathMode])

  const setJmespathMode = (mode: 'filter' | 'highlight') => {
    if (onJMESPathStateChange) {
      onJMESPathStateChange({ enabled: jmespathEnabled, query: jmespathQuery, mode })
    } else {
      setInternalJmespathMode(mode)
    }
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
    setHistoryIndex(-1)
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
    setHistoryIndex(-1)
    setJmespathQuery(newValue)
  }

  const toggleHighlightMode = useCallback(() => {
    // Enable JMESPath in highlight mode (like ⌘Click), or toggle off if already active
    const isActiveHighlight = jmespathEnabled && jmespathMode === 'highlight'
    if (onJMESPathStateChange) {
      onJMESPathStateChange({ enabled: !isActiveHighlight, query: jmespathQuery, mode: 'highlight' })
    } else {
      if (isActiveHighlight) {
        setInternalJmespathEnabled(false)
      } else {
        setInternalJmespathEnabled(true)
        setInternalJmespathMode('highlight')
      }
    }
  }, [jmespathEnabled, jmespathMode, jmespathQuery, onJMESPathStateChange])

  const toggleTruncateValues = useCallback(() => setTruncateValues((v) => !v), [])
  const toggleUniqueFilter = useCallback(() => setUniqueFilter((v) => !v), [])

  const toggleFilterMode = useCallback(() => {
    // Enable JMESPath in filter mode (like ⌘Click), or toggle off if already active
    const isActiveFilter = jmespathEnabled && jmespathMode === 'filter'
    if (onJMESPathStateChange) {
      onJMESPathStateChange({ enabled: !isActiveFilter, query: jmespathQuery, mode: 'filter' })
    } else {
      if (isActiveFilter) {
        setInternalJmespathEnabled(false)
      } else {
        setInternalJmespathEnabled(true)
        setInternalJmespathMode('filter')
      }
    }
  }, [jmespathEnabled, jmespathMode, jmespathQuery, onJMESPathStateChange])

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'h') return
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'pre') return
      e.preventDefault()
      setShowHotkeyInfo(true)
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
      setHistoryIndex(-1)
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
      setHistoryIndex(-1)
      setJmespathQuery(next)
      return
    }
  }

  const addToHistory = useCallback((query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setJmespathHistory((prev) => {
      const filtered = prev.filter((h) => h !== trimmed)
      return [trimmed, ...filtered].slice(0, 10)
    })
  }, [])

  // Add to history when query changes externally (e.g. cmd+click from JSON viewer).
  // Also push the old value onto the undo stack so Cmd+Z can revert it.
  useEffect(() => {
    if (prevQueryRef.current !== jmespathQuery && !isInputFocusedRef.current) {
      const old = prevQueryRef.current
      if (old !== jmespathQuery) {
        undoStackRef.current = [...undoStackRef.current, old].slice(-100)
        redoStackRef.current = []
      }
      addToHistory(jmespathQuery)
      setHistoryIndex(-1)
    }
    prevQueryRef.current = jmespathQuery
  }, [jmespathQuery, addToHistory])

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
    if (!raw || hiddenColumnsRef.current.size === 0) return raw
    const visibleIndices = raw.columns.map((c, i) => ({ c, i })).filter(({ c }) => !hiddenColumnsRef.current.has(c)).map(({ i }) => i)
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
      if (tsv) {
        const htmlTable = (() => {
          const data = getTableData()
          if (!data) return ''
          const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          const headerCells = data.columns.map(c => `<th>${esc(c)}</th>`).join('')
          const bodyRows = data.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')
          return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
        })()
        const blob = new Blob([htmlTable], { type: 'text/html' })
        const textBlob = new Blob([tsv], { type: 'text/plain' })
        navigator.clipboard.write([
          new ClipboardItem({
            'text/html': blob,
            'text/plain': textBlob,
          }),
        ])
        toast.success('Copied table to clipboard')
        return
      }
    }
    if (viewMode === 'markdown') {
      const md = getEffectiveMarkdownContent()
      if (md) {
        navigator.clipboard.writeText(md)
        toast.success('Copied Markdown to clipboard')
        return
      }
    }
    const effectiveContent = getEffectiveContent()
    navigator.clipboard.writeText(effectiveContent)
    toast.success(
      jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim()
        ? 'Copied filtered content to clipboard'
        : 'Copied to clipboard',
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
    navigator.clipboard.writeText(text)
    toast.success(`Copied as ${label}`)
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
  const { filteredContent, matchedPaths, jmespathError } = useMemo(() => {
    if (!jmespathEnabled || !debouncedQuery.trim() || !isJson) {
      return { filteredContent: null, matchedPaths: new Set<string>(), jmespathError: null }
    }

    try {
      // Use the parse cache so we don't re-parse the same string twice
      const parsed = getParsedContent(content)

      let result = getCachedJmespathResult(content, debouncedQuery)
      if (result === undefined) {
        result = jmespath.search(parsed, debouncedQuery)
        setCachedJmespathResult(content, debouncedQuery, result)
      }

      if (jmespathMode === 'filter') {
        return {
          filteredContent: JSON.stringify(result, null, 2),
          matchedPaths: new Set<string>(),
          jmespathError: null,
        }
      }

      // Highlight mode: compute the full matched-path set here so it is
      // memoized and not recomputed on every unrelated render.
      const paths = findJmespathJsonLocations(parsed, result, debouncedQuery)
      return { filteredContent: null, matchedPaths: paths, jmespathError: null }
    } catch (e: unknown) {
      return {
        filteredContent: null,
        matchedPaths: new Set<string>(),
        jmespathError: e instanceof Error ? e.message : 'Invalid JMESPath query',
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

  // tableData and sortedRows are computed later (after displayContent is available)

  const renderTableView = () => {
    if (!tableData) return <span className="text-muted-foreground text-sm">No tabular data available</span>

    const addToSqlHistory = (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) return
      setSqlHistory(prev => {
        const filtered = prev.filter(h => h !== trimmed)
        return [trimmed, ...filtered].slice(0, 20)
      })
    }

    const handleCellClick = (colName: string, value: string) => (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        const escapedValue = value.replace(/'/g, "''")
        const clause = `${colName} = '${escapedValue}'`

        if (sqlQuery.trim()) {
          // Append AND clause to existing query, but skip if already present
          const whereMatch = sqlQuery.match(/^(SELECT\s+.+?\s+FROM\s+\?\s+WHERE\s+)(.+)$/i)
          if (whereMatch) {
            // Check if this exact clause already exists in the WHERE conditions
            const existingClauses = whereMatch[2].split(/\s+AND\s+/i).map(c => c.trim())
            if (existingClauses.some(c => c.toLowerCase() === clause.toLowerCase())) {
              return // Duplicate clause, skip
            }
            const newQuery = `${whereMatch[1]}${whereMatch[2]} AND ${clause}`
            setSqlQuery(newQuery)
            addToSqlHistory(newQuery)
          } else {
            const query = `SELECT * FROM ? WHERE ${clause}`
            setSqlQuery(query)
            addToSqlHistory(query)
          }
        } else {
          const query = `SELECT * FROM ? WHERE ${clause}`
          setSqlQuery(query)
          addToSqlHistory(query)
        }
        setSqlError(null)
      }
    }

    // Use SQL result columns if available (rows are already sorted via sortedRows); apply hidden columns filter
    // In highlight mode, always show all original columns
    const rawDisplayData = { columns: (sqlMode === 'highlight' ? tableData : (sqlResult || tableData)).columns, rows: sortedRows }
    const displayData = hiddenColumns.size === 0 ? rawDisplayData : (() => {
      const visibleIndices = rawDisplayData.columns.map((c, i) => ({ c, i })).filter(({ c }) => !hiddenColumns.has(c)).map(({ i }) => i)
      return {
        columns: visibleIndices.map(i => rawDisplayData.columns[i]),
        rows: rawDisplayData.rows.map(row => visibleIndices.map(i => row[i])),
      }
    })()

    return (
      <div className="flex flex-col h-full">
        {/* Joining Column Controls — between JMESPath row and SQL bar */}
        {joiningColumnsRow()}
        {/* SQL Query Bar - fixed, not scrollable */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary shrink-0">
              <FileCode className="h-3.5 w-3.5" />
              SQL
            </div>
            <div className="flex-1 relative">
              <Input
                ref={sqlInputRef}
                placeholder="e.g. SELECT * FROM ? WHERE status = 'active' — ⌘+Click cells to build filters"
                value={sqlQuery}
                onChange={(e) => { setSqlQuery(e.target.value); setSqlError(null); setSqlHistoryIndex(-1) }}
                onFocus={() => {}}
                onBlur={() => { setShowSqlHistory(false) }}
                onDoubleClick={() => { if (sqlHistory.length > 0) setShowSqlHistory(true) }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    if (showSqlHistory) { setShowSqlHistory(false); return }
                    if (sqlHistoryIndex !== -1) {
                      setSqlHistoryIndex(-1)
                      setSqlQuery(savedSqlRef.current)
                      return
                    }
                    setSqlQuery('')
                    setSqlError(null)
                  }
                  if (e.key === 'Enter') {
                    if (sqlQuery.trim()) addToSqlHistory(sqlQuery)
                    setSqlHistoryIndex(-1)
                    setShowSqlHistory(false)
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    if (sqlHistory.length === 0) return
                    if (sqlHistoryIndex === -1) savedSqlRef.current = sqlQuery
                    const newIdx = Math.min(sqlHistoryIndex + 1, sqlHistory.length - 1)
                    setSqlHistoryIndex(newIdx)
                    setSqlQuery(sqlHistory[newIdx])
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    if (sqlHistoryIndex === -1) return
                    const newIdx = sqlHistoryIndex - 1
                    setSqlHistoryIndex(newIdx)
                    setSqlQuery(newIdx === -1 ? savedSqlRef.current : sqlHistory[newIdx])
                  }
                }}
                className={`h-7 text-xs font-mono ${sqlError ? 'border-destructive' : ''}`}
                title="↑↓ to browse history | Double-click to show history | Enter to commit"
              />
              {showSqlHistory && sqlHistory.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden max-h-48 overflow-y-auto">
                  {sqlHistory.map((expr, i) => (
                    <button
                      key={i}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-muted truncate block ${i === sqlHistoryIndex ? 'bg-muted' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setSqlQuery(expr)
                        setSqlHistoryIndex(-1)
                        setShowSqlHistory(false)
                      }}
                    >
                      {expr}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {sqlQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs shrink-0"
                onClick={() => { setSqlQuery(''); setSqlError(null); setSqlHistoryIndex(-1) }}
              >
                Clear
              </Button>
            )}
            <ToggleGroup
              type="single"
              value={sqlMode}
              onValueChange={(val) => val && setSqlMode(val as 'filter' | 'highlight')}
              className="gap-0 shrink-0"
            >
              <ToggleGroupItem
                value="filter"
                size="sm"
                className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                title="Filter: Show only matched rows"
              >
                <Filter className="h-3 w-3" />
                <span className="hidden sm:inline">Filter</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="highlight"
                size="sm"
                className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                title="Highlight: Show all rows, highlight matches"
              >
                <Highlighter className="h-3 w-3" />
                <span className="hidden sm:inline">Highlight</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {/* SQL Error */}
          {sqlError && (
            <div className="px-3 py-1.5 border-b border-border bg-destructive/10 text-xs text-destructive font-mono">
              {sqlError}
            </div>
          )}
          {/* Hidden columns indicator */}
          {hiddenColumns.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/20 text-xs text-muted-foreground">
              <EyeOff className="h-3 w-3 shrink-0" />
              <span>{hiddenColumns.size} column{hiddenColumns.size > 1 ? 's' : ''} hidden</span>
              <button
                className="text-primary hover:underline ml-1"
                onClick={() => setHiddenColumns(new Set())}
              >
                Show all
              </button>
            </div>
          )}
        </div>
        {/* Scrollable table content */}
        <div className="flex-1 overflow-auto">
          <Table disableContainerOverflow>
            <TableHeader className="bg-primary/10">
              <TableRow className="border-b-2 border-primary/30 hover:bg-primary/15">
                <TableHead className="sticky top-0 z-20 bg-muted text-muted-foreground font-semibold w-[3ch]">#</TableHead>
                {displayData.columns.map((col, i) => {
                  const isSelectedCol = sqlMode === 'highlight' && sqlHighlightInfo.selectedColumns?.includes(col)
                  return (
                  <TableHead
                    key={i}
                    className={`sticky top-0 z-20 bg-muted cursor-pointer select-none font-semibold hover:text-primary/80 transition-colors group/col ${isSelectedCol ? 'text-yellow-400' : 'text-primary'}`}
                    onClick={() => handleColumnSort(i)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {sortColumn === i ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                      <button
                        className="opacity-0 group-hover/col:opacity-100 ml-0.5 text-muted-foreground hover:text-destructive transition-opacity"
                        title="Hide column"
                        onClick={(e) => {
                          e.stopPropagation()
                          setHiddenColumns(prev => new Set([...prev, col]))
                          setSortColumn(null)
                        }}
                      >
                        <EyeOff className="h-3 w-3" />
                      </button>
                    </span>
                  </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.rows.map((row, ri) => {
                const originalIdx = sqlMode === 'highlight' ? sortedOriginalIndices[ri] : ri
                const isHighlightMatch = sqlMode === 'highlight' && sqlQuery.trim() ? sqlHighlightInfo.matchedRowIndices.has(originalIdx) : false
                const isHighlightActive = sqlMode === 'highlight' && sqlQuery.trim()
                return (
                <TableRow
                  key={ri}
                  className={
                    isHighlightActive
                      ? isHighlightMatch ? '' : 'opacity-30'
                      : ri % 2 === 0 ? 'bg-muted/20' : ''
                  }
                >
                  <TableCell className="font-mono text-xs text-muted-foreground/50 py-2.5 w-[3ch]">{ri}</TableCell>
                  {row.map((cell, ci) => {
                    // selectedColumns=null means SELECT * → highlight all cells; otherwise only the named columns
                    const isCellHighlighted = isHighlightMatch && (
                      !sqlHighlightInfo.selectedColumns || sqlHighlightInfo.selectedColumns.includes(displayData.columns[ci])
                    )
                    const cellBg = isCellHighlighted
                      ? 'bg-primary/30 font-semibold'
                      : isHighlightMatch ? 'opacity-30' : ''
                    return (
                    <TableCell
                      key={ci}
                      className={`font-mono text-xs cursor-pointer hover:bg-primary/5 transition-colors py-2.5 ${cellBg}`}
                      onClick={handleCellClick(displayData.columns[ci], cell)}
                      title="⌘+Click to add SQL filter"
                    >
                      {cell}
                    </TableCell>
                    )
                  })}
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  const renderMarkdownView = () => {
    const mdContent = getEffectiveMarkdownContent()

    if (mdContent === null) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Content is not valid Markdown. Switch to JSON view to see the data.
        </div>
      )
    }

    if (!mdContent || !mdContent.trim()) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          No content to render as Markdown.
        </div>
      )
    }

    try {
      return (
        <MarkdownErrorBoundary key={mdContent}>
          <div className="prose prose-sm dark:prose-invert max-w-none p-4 prose-headings:text-primary prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-border prose-table:text-sm prose-th:text-primary prose-th:font-semibold prose-th:text-left prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2 prose-td:text-foreground prose-tr:border-b prose-tr:border-border prose-thead:border-b-2 prose-thead:border-primary/30">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{mdContent}</ReactMarkdown>
          </div>
        </MarkdownErrorBoundary>
      )
    } catch {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Failed to render Markdown. The content may not be valid Markdown.
        </div>
      )
    }
  }

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
        <Button
          variant={uniqueFilter && duplicateCount > 0 ? 'destructive' : uniqueFilter ? 'default' : 'outline'}
          size="sm"
          className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
          onClick={toggleUniqueFilter}
          title="Filter duplicate values (⌘U)"
        >
          <Fingerprint className="h-3.5 w-3.5" />
          {showText && <span>Unique</span>}
        </Button>
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
          <ContextMenuItem onClick={handleCopy}>
            Copy as Table (Excel/Email)
          </ContextMenuItem>
          {viewMode === 'table' && (
            <>
              <ContextMenuItem onClick={() => { const md = getTableMarkdown(); if (md) copyText(md, 'Markdown') }}>
                Copy as Markdown
              </ContextMenuItem>
              <ContextMenuItem onClick={() => { const csv = getTableCsv(); if (csv) copyText(csv, 'CSV') }}>
                Copy as CSV
              </ContextMenuItem>
              <ContextMenuItem onClick={() => { const js = getTableJsCode(); if (js) copyText(js, 'Code') }}>
                Copy as Code
              </ContextMenuItem>
              <ContextMenuItem onClick={() => { const sql = getTableSql(); if (sql) copyText(sql, 'SQL') }}>
                Copy as SQL
              </ContextMenuItem>
            </>
          )}
          {viewMode !== 'table' && isJson && (
            <ContextMenuItem onClick={handleDownloadCsv}>
              Copy as CSV
            </ContextMenuItem>
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

  const jmespathRow = (inputRef: React.RefObject<HTMLInputElement>, disabled = false) => (
    <div className={`flex items-center gap-3 px-3 py-2 border-b border-border ${disabled ? 'bg-muted/50 opacity-50 pointer-events-none' : 'bg-muted/20'}`}>
      <div className="flex items-center gap-2">
        <Switch
          id="jmespath-toggle"
          checked={jmespathEnabled}
          onCheckedChange={setJmespathEnabled}
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
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            isInputFocusedRef.current = true
            activeInputRef.current = inputRef.current
          }}
          onBlur={() => {
            isInputFocusedRef.current = false
            setShowHistory(false)
          }}
          onDoubleClick={() => {
            if (jmespathHistory.length > 0) setShowHistory(true)
          }}
          onKeyDown={(e) => {
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
            if ((e.metaKey || e.ctrlKey) && e.key === '8') {
              e.preventDefault()
              applyWildcard()
              return
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
              e.preventDefault()
              toggleTruncateValues()
              return
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
              e.preventDefault()
              toggleUniqueFilter()
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
              setJmespathQuery(prev)
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
              setJmespathQuery(next)
              return
            }
            if (e.key === 'Enter') {
              if (historyIndex !== -1) {
                // Committing a history navigation — push saved query to undo stack
                applyQueryProgrammatic(jmespathQuery)
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
                setJmespathQuery(savedQueryRef.current)
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
              setJmespathQuery(jmespathHistory[newIndex])
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (historyIndex === -1) return
              const newIndex = historyIndex - 1
              setHistoryIndex(newIndex)
              // Temporary navigation — no undo push
              setJmespathQuery(newIndex === -1 ? savedQueryRef.current : jmespathHistory[newIndex])
              return
            }
          }}
          disabled={!jmespathEnabled}
          className={`h-7 text-xs font-mono ${jmespathError ? 'border-destructive' : ''}`}
          title="Cmd/Ctrl+8 to wildcard array indices | ↑↓ to browse history | Double-click to show history"
        />
        {showHistory && jmespathHistory.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
            {jmespathHistory.map((expr, i) => (
              <button
                key={i}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-muted truncate block ${i === historyIndex ? 'bg-muted' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  applyQueryProgrammatic(expr)
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
        onValueChange={(val) => val && setJmespathMode(val as 'filter' | 'highlight')}
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

  const joiningColumnsRow = () => {
    if (!joiningContext) return null
    return (
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={joiningEnabled} onCheckedChange={setJoiningEnabled} className="scale-75" />
          <Label className="text-xs font-medium text-muted-foreground">Join</Label>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {joiningContext.joiningColumns.map((col) => (
            <span key={col} className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-muted-foreground">
              {col}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Calculate line count
  const displayContent =
    uniqueFilter && uniqueFilteredContent !== null
      ? uniqueFilteredContent
      : jmespathEnabled && jmespathMode === 'filter' && filteredContent !== null
        ? filteredContent
        : content
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

  // Parse table data from displayContent (JSON array of objects or primitives, or CSV string)
  // Only compute when table view is active to avoid expensive processing during JMESPath editing
  const tableData = useMemo(() => {
    if (viewMode !== 'table') return null
    // Try JSON first
    try {
      const parsed = JSON.parse(displayContent)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'object' && parsed[0] !== null && !Array.isArray(parsed[0])) {
          const columns = Array.from(new Set(parsed.flatMap((item: any) => Object.keys(item))))
          const rows = parsed.map((item: any) => columns.map((col) => {
            const val = item[col]
            return val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
          }))
          // Add joining columns if active
          if (joiningEnabled && joiningContext && joiningContext.joiningColumns.length > 0) {
            const enhancedColumns = [...joiningContext.joiningColumns, ...columns]
            const enhancedRows = rows.map((row, i) => [
              ...(joiningContext.rowIndices[i] ?? joiningContext.joiningColumns.map(() => '')),
              ...row,
            ])
            return { columns: enhancedColumns, rows: enhancedRows }
          }
          return { columns, rows }
        }
        // Array of primitives
        const rows = parsed.map((v: any) => [v === null || v === undefined ? '' : String(v)])
        if (joiningEnabled && joiningContext && joiningContext.joiningColumns.length > 0) {
          const enhancedColumns = [...joiningContext.joiningColumns, 'value']
          const enhancedRows = rows.map((row, i) => [
            ...(joiningContext.rowIndices[i] ?? joiningContext.joiningColumns.map(() => '')),
            ...row,
          ])
          return { columns: enhancedColumns, rows: enhancedRows }
        }
        return { columns: ['value'], rows }
      }
    } catch {
      // Not JSON — try CSV
    }
    // Try CSV parse (simple: split by newlines, split by comma)
    const lines = displayContent.trim().split('\n').filter((l: string) => l.trim())
    if (lines.length >= 1) {
      const parseCsvLine = (line: string) => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
            else if (ch === '"') inQuotes = false
            else current += ch
          } else {
            if (ch === '"') inQuotes = true
            else if (ch === ',') { result.push(current); current = '' }
            else current += ch
          }
        }
        result.push(current)
        return result
      }
      const headerRow = parseCsvLine(lines[0])
      const hasHeader = headerRow.every((h) => isNaN(Number(h)) && h.trim().length > 0)
      if (hasHeader && lines.length > 1) {
        const rows = lines.slice(1).map(parseCsvLine)
        return { columns: headerRow, rows }
      }
      const colCount = headerRow.length
      const columns = colCount === 1 ? ['value'] : Array.from({ length: colCount }, (_, i) => `col${i + 1}`)
      const rows = lines.map(parseCsvLine)
      return { columns, rows }
    }
    return null
  }, [displayContent, viewMode, joiningEnabled, joiningContext])
  tableDataRef.current = tableData

  const handleColumnSort = (colIndex: number) => {
    if (sortColumn === colIndex) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(colIndex)
      setSortDirection('asc')
    }
  }

  // Auto-enable joining when context becomes available, auto-disable when it disappears
  useEffect(() => {
    setJoiningEnabled(joiningContext !== null && joiningContext.joiningColumns.length > 0)
  }, [joiningContext])

  // Reset sort column when joining enabled state changes to avoid index shift bugs
  useEffect(() => { setSortColumn(null) }, [joiningEnabled])

  // Keep hiddenColumnsRef in sync (used in copy/export callbacks that close over the ref)
  useEffect(() => { hiddenColumnsRef.current = hiddenColumns }, [hiddenColumns])

  // Reset hidden columns when the set of column names changes
  useEffect(() => {
    setHiddenColumns(new Set())
  }, [tableData?.columns.join('\0')])

  // Normalize SQL to support reserved column names (e.g. value)
  const normalizedSqlQuery = useMemo(() => {
    if (!tableData || !sqlQuery.trim()) return sqlQuery
    if (!tableData.columns.includes('value')) return sqlQuery

    // Replace bare identifier `value` outside string literals with `[value]`
    const segments = sqlQuery.split(/('(?:''|[^'])*')/)
    return segments
      .map((segment, index) => (index % 2 === 1 ? segment : segment.replace(/\bvalue\b/gi, '[value]')))
      .join('')
  }, [sqlQuery, tableData])

  // Execute SQL query against table data using AlaSQL
  // Only compute when table view is active
  const sqlResult = useMemo(() => {
    if (viewMode !== 'table' || !sqlQuery.trim() || !tableData) return null
    try {
      const joiningColSet = new Set(joiningContext?.joiningColumns ?? [])
      const data = tableData.rows.map(row => {
        const obj: Record<string, string | number | boolean> = {}
        tableData.columns.forEach((col, i) => {
          const v = row[i]
          // Joining columns are positional indices — keep as strings so
          // SQL string comparisons like `WHERE hits = '2'` work correctly.
          if (joiningColSet.has(col)) {
            obj[col] = v
          } else if (v === '') {
            obj[col] = v
          } else if (v === 'true') {
            obj[col] = true
          } else if (v === 'false') {
            obj[col] = false
          } else {
            const num = Number(v)
            obj[col] = !isNaN(num) && v.trim() !== '' ? num : v
          }
        })
        return obj
      })

      const result = alasql(normalizedSqlQuery, [data])
      setSqlError(null)

      if (Array.isArray(result) && result.length === 0) {
        return { columns: tableData.columns, rows: [] }
      }

      if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
        const cols = Object.keys(result[0])
        const rows = result.map((r: any) => cols.map(c => {
          const v = r[c]
          return v === null || v === undefined ? '' : String(v)
        }))
        return { columns: cols, rows }
      }

      // For aggregation results like COUNT, SUM etc that return a single value
      if (Array.isArray(result) && result.length > 0) {
        const first = result[0]
        if (typeof first === 'object' && first !== null) {
          const cols = Object.keys(first)
          const rows = result.map((r: any) => cols.map(c => String(r[c] ?? '')))
          return { columns: cols, rows }
        }
      }
      return null
    } catch (e: any) {
      setSqlError(e?.message || 'Invalid SQL query')
      return null
    }
  }, [sqlQuery, normalizedSqlQuery, tableData, viewMode])
  sqlResultRef.current = sqlResult

  // Compute highlight info for SQL highlight mode: which original row indices match and which columns are selected
  const sqlHighlightInfo = useMemo(() => {
    if (viewMode !== 'table' || !sqlQuery.trim() || !tableData || sqlMode !== 'highlight') {
      return { matchedRowIndices: new Set<number>(), selectedColumns: null as string[] | null }
    }
    try {
      const joiningColSet = new Set(joiningContext?.joiningColumns ?? [])
      const data = tableData.rows.map((row, rowIdx) => {
        const obj: Record<string, any> = { __rowIdx: rowIdx }
        tableData.columns.forEach((col, i) => {
          const v = row[i]
          if (joiningColSet.has(col)) {
            obj[col] = v
          } else if (v === '') {
            obj[col] = v
          } else if (v === 'true') {
            obj[col] = true
          } else if (v === 'false') {
            obj[col] = false
          } else {
            const num = Number(v)
            obj[col] = !isNaN(num) && v.trim() !== '' ? num : v
          }
        })
        return obj
      })

      // Extract selected columns from SELECT clause (null means *)
      const selectMatch = normalizedSqlQuery.match(/^SELECT\s+(.*?)\s+FROM\s+\?/i)
      let selectedColumns: string[] | null = null
      if (selectMatch) {
        const selectCols = selectMatch[1].trim()
        if (selectCols !== '*') {
          selectedColumns = selectCols
            .split(',')
            .map(c => c.trim().replace(/^\[|\]$/g, '').split(/\s+as\s+/i)[0].trim())
        }
      }

      // Build a query using everything after FROM ? (keeps WHERE, ORDER BY, etc.) but selects only __rowIdx
      const fromMatch = normalizedSqlQuery.match(/\bFROM\s+\?\s*(.*?)$/i)
      const conditionsClause = fromMatch ? fromMatch[1].trim() : ''
      const highlightQuery = `SELECT __rowIdx FROM ? ${conditionsClause}`

      const result = alasql(highlightQuery, [data])
      const matchedRowIndices = new Set<number>()
      if (Array.isArray(result)) {
        result.forEach((r: any) => {
          if (typeof r.__rowIdx === 'number') matchedRowIndices.add(r.__rowIdx)
        })
      }
      return { matchedRowIndices, selectedColumns }
    } catch {
      return { matchedRowIndices: new Set<number>(), selectedColumns: null as string[] | null }
    }
  }, [viewMode, sqlQuery, normalizedSqlQuery, tableData, sqlMode, joiningContext])

  const { sortedRows, sortedOriginalIndices } = useMemo(() => {
    const baseRows = (sqlMode === 'highlight' ? tableData?.rows : (sqlResult ? sqlResult.rows : tableData?.rows)) ?? []
    if (viewMode !== 'table' || !baseRows.length || sortColumn === null) {
      return { sortedRows: baseRows, sortedOriginalIndices: baseRows.map((_, i) => i) }
    }
    const col = sortColumn
    const indexed = baseRows.map((row, i) => ({ row, origIdx: i }))
    const sorted = [...indexed].sort((a, b) => {
      const aVal = a.row[col] ?? ''
      const bVal = b.row[col] ?? ''
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      const isNumeric = aVal !== '' && bVal !== '' && !isNaN(aNum) && !isNaN(bNum)
      const cmp = isNumeric ? aNum - bNum : String(aVal).localeCompare(String(bVal))
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return { sortedRows: sorted.map(s => s.row), sortedOriginalIndices: sorted.map(s => s.origIdx) }
  }, [tableData, sqlResult, sqlMode, sortColumn, sortDirection, viewMode])




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
        {isJson && jmespathRow(normalInputRef, viewMode !== 'json')}
        <div
          className="p-0 overflow-auto flex-1 outline-none"
          style={{ maxHeight }}
          tabIndex={0}
          onKeyDown={viewMode === 'json' ? (e) => handleViewerKeyDown(e, normalPreRef) : undefined}
        >
          {viewMode === 'json' && (
            <pre ref={normalPreRef} className="text-sm font-mono text-foreground whitespace-pre-wrap break-all p-4">
              <code>{renderedContent}</code>
            </pre>
          )}
          {viewMode === 'markdown' && renderMarkdownView()}
          {viewMode === 'table' && renderTableView()}
        </div>
        {/* Status ribbon */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <div>{jmespathError && <span className="text-destructive">{jmespathError}</span>}</div>
          <div className="flex items-center gap-4">
            {viewMode === 'table' && tableData ? (
              (() => {
                const total = tableData.rows.length
                const selected = sqlQuery.trim()
                  ? sqlMode === 'filter' ? (sqlResult?.rows.length ?? total) : sqlHighlightInfo.matchedRowIndices.size
                  : null
                return <span>{selected !== null ? `${selected}/${total}` : total.toLocaleString()} rows</span>
              })()
            ) : (
              jsonStats?.type === 'array' && <span>{jsonStats.count} items</span>
            )}
            {duplicateCount > 0 && <span className="text-red-400">{duplicateCount} duplicates</span>}
            {jsonStats && jsonStats.totalKeys > 0 && <span>{jsonStats.totalKeys.toLocaleString()} total keys</span>}
            {jsonStats?.type === 'object' && (
              <>
                <span>{jsonStats.keys.toLocaleString()} keys</span>
                <span>depth {jsonStats.depth}</span>
              </>
            )}
            <span>Ln {lineCount.toLocaleString()}</span>
            <span>{displayContent.length.toLocaleString()} chars</span>
            {filterPercent !== null && <span className="text-primary">{filterPercent}% of response</span>}
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
          {isJson && jmespathRow(dialogInputRef)}
          <div
            ref={dialogContentRef}
            className="flex-1 overflow-auto p-0 outline-none"
            tabIndex={0}
            onKeyDown={viewMode === 'json' ? (e) => handleViewerKeyDown(e, dialogPreRef) : undefined}
          >
            {viewMode === 'json' && (
              <pre ref={dialogPreRef} className="text-sm font-mono text-foreground whitespace-pre-wrap break-all p-6">
                <code>{renderedContent}</code>
              </pre>
            )}
            {viewMode === 'markdown' && renderMarkdownView()}
            {viewMode === 'table' && renderTableView()}
          </div>
          {/* Status ribbon in maximized view */}
          <div className="flex items-center justify-between px-6 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
            <div>{jmespathError && <span className="text-destructive">{jmespathError}</span>}</div>
            <div className="flex items-center gap-4">
              {viewMode === 'table' && tableData ? (
                (() => {
                  const total = tableData.rows.length
                  const selected = sqlQuery.trim()
                    ? sqlMode === 'filter' ? (sqlResult?.rows.length ?? total) : sqlHighlightInfo.matchedRowIndices.size
                    : null
                  return <span>{selected !== null ? `${selected}/${total}` : total.toLocaleString()} rows</span>
                })()
              ) : (
                jsonStats?.type === 'array' && <span>{jsonStats.count.toLocaleString()} items</span>
              )}
              {duplicateCount > 0 && <span className="text-red-400">{duplicateCount} duplicates</span>}
              {jsonStats && jsonStats.totalKeys > 0 && <span>{jsonStats.totalKeys.toLocaleString()} total keys</span>}
              {jsonStats?.type === 'object' && (
                <>
                  <span>{jsonStats.keys.toLocaleString()} keys</span>
                  <span>depth {jsonStats.depth}</span>
                </>
              )}
              <span>Ln {lineCount.toLocaleString()}</span>
              <span>{displayContent.length.toLocaleString()} chars</span>
              {filterPercent !== null && <span className="text-primary">{filterPercent}% of response</span>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <HotkeyInfoDialog open={showHotkeyInfo} onOpenChange={setShowHotkeyInfo} />
    </>
  )
}
