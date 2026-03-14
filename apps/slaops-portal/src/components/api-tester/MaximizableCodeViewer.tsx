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
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import jmespath from 'jmespath'
import {
  AlignLeft,
  ArrowLeftRight,
  BookOpen,
  Copy,
  Download,
  FileCode,
  Filter,
  Fingerprint,
  Highlighter,
  Keyboard,
  Maximize2,
  Minimize2,
  WrapText,
} from 'lucide-react'
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { JsonResponseViewer } from './JsonResponseViewer'

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
  const normalInputRef = useRef<HTMLInputElement>(null)
  const dialogInputRef = useRef<HTMLInputElement>(null)
  const normalPreRef = useRef<HTMLPreElement>(null)
  const dialogPreRef = useRef<HTMLPreElement>(null)

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

  const setJmespathEnabled = (enabled: boolean) => {
    if (onJMESPathStateChange) {
      onJMESPathStateChange({ enabled, query: jmespathQuery, mode: jmespathMode })
    } else {
      setInternalJmespathEnabled(enabled)
    }
  }

  const setJmespathQuery = (query: string) => {
    if (onJMESPathStateChange) {
      onJMESPathStateChange({ enabled: jmespathEnabled, query, mode: jmespathMode })
    } else {
      setInternalJmespathQuery(query)
    }
  }

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
    if (jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim() && isJson) {
      try {
        const parsed = JSON.parse(content)
        const result = jmespath.search(parsed, jmespathQuery)
        return JSON.stringify(result, null, 2)
      } catch {
        return content
      }
    }
    return content
  }

  const handleCopy = () => {
    const effectiveContent = getEffectiveContent()
    navigator.clipboard.writeText(effectiveContent)
    toast.success(
      jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim()
        ? 'Copied filtered content to clipboard'
        : 'Copied to clipboard',
    )
  }

  const handleDownload = () => {
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

  // JMESPath filtering/highlighting logic
  const { filteredContent, matchedPaths, jmespathError } = useMemo(() => {
    if (!jmespathEnabled || !jmespathQuery.trim() || !isJson) {
      return { filteredContent: null, matchedPaths: new Set<string>(), jmespathError: null }
    }

    try {
      const parsed = JSON.parse(content)
      const result = jmespath.search(parsed, jmespathQuery)

      if (jmespathMode === 'filter') {
        return {
          filteredContent: JSON.stringify(result, null, 2),
          matchedPaths: new Set<string>(),
          jmespathError: null,
        }
      } else {
        // Highlight mode: find all paths that match
        const paths = new Set<string>()
        const findPaths = (obj: any, query: string, currentPath: string = '') => {
          try {
            const res = jmespath.search(obj, query)
            if (res !== null && res !== undefined) {
              // Collect the values that match for highlighting
              collectMatchingValues(parsed, result, paths, '')
            }
          } catch {
            // Ignore errors in path finding
          }
        }

        const collectMatchingValues = (
          original: any,
          matched: any,
          paths: Set<string>,
          path: string,
        ) => {
          if (matched === null || matched === undefined) return

          if (typeof matched !== 'object') {
            // It's a primitive - find where it exists in the original
            findValuePaths(original, matched, paths, '')
          } else if (Array.isArray(matched)) {
            matched.forEach((item, idx) => {
              collectMatchingValues(original, item, paths, `${path}[${idx}]`)
            })
          } else {
            Object.keys(matched).forEach((key) => {
              collectMatchingValues(original, matched[key], paths, path ? `${path}.${key}` : key)
            })
          }
        }

        const findValuePaths = (obj: any, value: any, paths: Set<string>, currentPath: string) => {
          if (obj === value) {
            paths.add(currentPath || 'root')
            return
          }
          if (typeof obj !== 'object' || obj === null) return

          if (Array.isArray(obj)) {
            obj.forEach((item, idx) => {
              findValuePaths(item, value, paths, `${currentPath}[${idx}]`)
            })
          } else {
            Object.entries(obj).forEach(([key, val]) => {
              findValuePaths(val, value, paths, currentPath ? `${currentPath}.${key}` : key)
            })
          }
        }

        findPaths(parsed, jmespathQuery)
        return { filteredContent: null, matchedPaths: paths, jmespathError: null }
      }
    } catch (e: unknown) {
      return {
        filteredContent: null,
        matchedPaths: new Set<string>(),
        jmespathError: e instanceof Error ? e.message : 'Invalid JMESPath query',
      }
    }
  }, [content, jmespathQuery, jmespathEnabled, jmespathMode, isJson])

  /**
   * Helper function to check deep structural equality between two values
   */
  const deepEqual = (a: any, b: any): boolean => {
    if (a === b) return true
    if (a == null || b == null) return false
    if (typeof a !== typeof b) return false

    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false

      if (Array.isArray(a)) {
        if (a.length !== b.length) return false
        return a.every((item, idx) => deepEqual(item, b[idx]))
      } else {
        const aKeys = Object.keys(a).sort()
        const bKeys = Object.keys(b).sort()
        if (aKeys.length !== bKeys.length) return false
        if (!aKeys.every((key, idx) => key === bKeys[idx])) return false
        return aKeys.every((key) => deepEqual(a[key], b[key]))
      }
    }

    return false
  }

  /**
   * Stage 1: Find character locations in JSON string that match the JMESPath result.
   * Returns a Set of JSON paths (e.g., "a", "items[0].name") that should be highlighted.
   */
  const findJmespathJsonLocations = (original: any, result: any, query: string): Set<string> => {
    const matchedPaths = new Set<string>()

    // Helper to recursively add a path and all its children
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

    // Try to handle simple field access queries (e.g., "a", "a.b.c", "items[0]", "a.b[1].c")
    // This regex matches simple path expressions
    const simplePathRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[\d+\])*$/

    if (simplePathRegex.test(query.trim())) {
      // Convert JMESPath notation to our path notation
      // e.g., "a.b[0].c" stays as "a.b[0].c"
      const path = query.trim()

      // Navigate to the value at this path
      const pathParts = path.match(/[a-zA-Z_$][a-zA-Z0-9_$]*|\[\d+\]/g) || []
      let current = original
      let valid = true

      for (const part of pathParts) {
        if (part.startsWith('[')) {
          // Array index
          const index = parseInt(part.slice(1, -1), 10)
          if (Array.isArray(current) && index >= 0 && index < current.length) {
            current = current[index]
          } else {
            valid = false
            break
          }
        } else {
          // Object key
          if (current && typeof current === 'object' && part in current) {
            current = current[part]
          } else {
            valid = false
            break
          }
        }
      }

      // If we successfully navigated to the path and it matches the result, highlight it
      if (valid && deepEqual(current, result)) {
        addPathAndChildren(current, path)
        return matchedPaths
      }
    }

    // For complex queries, use structural matching
    // Helper to check if a value is structurally contained in the result
    const isInResult = (value: any, result: any, checkPartial: boolean = true): boolean => {
      // Exact structural match
      if (deepEqual(value, result)) return true

      if (!checkPartial) return false

      // Check if value is contained within result structure
      if (Array.isArray(result)) {
        return result.some((item) => isInResult(value, item, true))
      }

      if (result && typeof result === 'object' && !Array.isArray(result)) {
        return Object.values(result).some((v) => isInResult(value, v, true))
      }

      return false
    }

    // Traverse the original object and mark paths that are in the result
    const traverse = (obj: any, currentPath: string): void => {
      // Check if this value is in the result
      if (isInResult(obj, result, true)) {
        matchedPaths.add(currentPath)
      }

      // Continue traversing children
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
   * Stage 2: Render JSON with highlighting based on matched paths.
   * Takes the parsed JSON object and a Set of paths to highlight.
   */
  const highlightJson = (parsed: any, matchedPaths: Set<string>): React.ReactNode => {
    const handleClick = (path: string) => (e: React.MouseEvent) => {
      if ((e.metaKey || e.ctrlKey) && path) {
        e.preventDefault()
        setJmespathQuery(path)
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

  const renderHighlightedJson = (jsonStr: string, matchedResult: any, query: string) => {
    try {
      const parsed = JSON.parse(jsonStr)

      // Stage 1: Find the paths in the JSON that match the JMESPath result
      const matchedPaths = findJmespathJsonLocations(parsed, matchedResult, query)

      // Stage 2: Render the JSON with highlighting applied to matched paths
      return highlightJson(parsed, matchedPaths)
    } catch {
      return jsonStr
    }
  }

  // When in filter mode, clicking a node should append to the existing expression
  // rather than replace it. If the current filtered result is an array, clicking a
  // key appends `[].key`; if it's an object, it appends `.key`.
  const handleFilteredJmespathSelect = (clickedPath: string) => {
    if (!jmespathQuery.trim() || filteredContent === null) {
      setJmespathQuery(clickedPath)
      return
    }

    try {
      const parsed = JSON.parse(filteredContent)
      if (Array.isArray(parsed)) {
        // Strip leading [number] or [number]. prefix and use [] wildcard instead
        if (/^\[\d+\]$/.test(clickedPath)) {
          // Clicking directly on an array element (no sub-path) — pipe to that index
          setJmespathQuery(`${jmespathQuery} | ${clickedPath}`)
        } else {
          // Clicking a property within an array element — wildcard projection
          const stripped = clickedPath.replace(/^\[\d+\]\.?/, '')
          const suffix = stripped
            ? stripped.startsWith('[') ? `[]${stripped}` : `[].${stripped}`
            : '[]'
          setJmespathQuery(`${jmespathQuery}${suffix}`)
        }
      } else {
        // Object: append with dot separator (or nothing if path starts with '[')
        const separator = clickedPath.startsWith('[') ? '' : '.'
        setJmespathQuery(`${jmespathQuery}${separator}${clickedPath}`)
      }
    } catch {
      setJmespathQuery(clickedPath)
    }
  }

  const renderContent = (unlimitedHeight = false) => {
    // If JMESPath filter mode and we have filtered content (unique filter applied on top if active)
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
            onJmespathSelect={setJmespathQuery}
            truncateValues={truncateValues}
          />
        )
      } catch {
        return uniqueFilteredContent
      }
    }

    // If JMESPath highlight mode
    if (
      jmespathEnabled &&
      jmespathMode === 'highlight' &&
      jmespathQuery.trim() &&
      isJson &&
      !jmespathError
    ) {
      try {
        const parsed = JSON.parse(content)
        const result = jmespath.search(parsed, jmespathQuery)
        return renderHighlightedJson(content, result, jmespathQuery)
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
            onJmespathSelect={setJmespathQuery}
            truncateValues={truncateValues}
          />
        )
      } catch {
        return content
      }
    }
    return content
  }

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
      <Button
        variant="outline"
        size="sm"
        className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
        onClick={handleCopy}
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
        {showText && <span>Copy</span>}
      </Button>
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
            Download as JSON
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDownloadCsv}>
            Download as CSV
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  )

  const jmespathRow = (inputRef: React.RefObject<HTMLInputElement>) => (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/20">
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

  // Compute pre-unique content (JMESPath filtered or original)
  const preUniqueContent =
    jmespathEnabled && jmespathMode === 'filter' && filteredContent !== null ? filteredContent : content

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

  // Effective filtered content for renderContent (unique filter applied on top)
  const effectiveFilteredContent =
    uniqueFilter && uniqueFilteredContent !== null ? uniqueFilteredContent : filteredContent

  // Calculate line count
  const displayContent =
    uniqueFilter && uniqueFilteredContent !== null
      ? uniqueFilteredContent
      : jmespathEnabled && jmespathMode === 'filter' && filteredContent !== null
        ? filteredContent
        : content
  const lineCount = displayContent.split('\n').length

  // Compute JSON stats for the status ribbon
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
            <FileCode className="h-4 w-4" />
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
        {isJson && jmespathRow(normalInputRef)}
        <div
          className={`p-4 overflow-auto flex-1 outline-none`}
          style={{ maxHeight }}
          tabIndex={0}
          onKeyDown={(e) => handleViewerKeyDown(e, normalPreRef)}
        >
          <pre ref={normalPreRef} className="text-sm font-mono text-foreground whitespace-pre-wrap break-all">
            <code>{renderContent()}</code>
          </pre>
        </div>
        {/* Status ribbon */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <div>{jmespathError && <span className="text-destructive">{jmespathError}</span>}</div>
          <div className="flex items-center gap-4">
            {jsonStats?.type === 'array' && <span>{jsonStats.count} items</span>}
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
                <FileCode className="h-5 w-5" />
                {title}
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
            className="flex-1 overflow-auto p-6 outline-none"
            tabIndex={0}
            onKeyDown={(e) => handleViewerKeyDown(e, dialogPreRef)}
          >
            <pre ref={dialogPreRef} className="text-sm font-mono text-foreground whitespace-pre-wrap break-all">
              <code>{renderContent(true)}</code>
            </pre>
          </div>
          {/* Status ribbon in maximized view */}
          <div className="flex items-center justify-between px-6 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
            <div>{jmespathError && <span className="text-destructive">{jmespathError}</span>}</div>
            <div className="flex items-center gap-4">
              {jsonStats?.type === 'array' && <span>{jsonStats.count.toLocaleString()} items</span>}
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
