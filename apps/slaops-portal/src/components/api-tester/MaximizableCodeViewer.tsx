import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  Highlighter,
  Keyboard,
  Maximize2,
  Minimize2,
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
  const normalInputRef = useRef<HTMLInputElement>(null)
  const dialogInputRef = useRef<HTMLInputElement>(null)
  const normalPreRef = useRef<HTMLPreElement>(null)
  const dialogPreRef = useRef<HTMLPreElement>(null)

  const applyWildcard = () => {
    const input = (isMaximized ? dialogInputRef : normalInputRef).current
    if (!input) return

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

    input.focus()
    input.select()
    document.execCommand('insertText', false, newValue)
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

  const toggleHighlightMode = useCallback(() => {
    if (onJMESPathStateChange) {
      const enabled = !(jmespathState?.enabled && jmespathState?.mode === 'highlight')
      onJMESPathStateChange({ enabled, query: jmespathState?.query ?? '', mode: 'highlight' })
    } else {
      if (internalJmespathEnabled && internalJmespathMode === 'highlight') {
        setInternalJmespathEnabled(false)
      } else {
        setInternalJmespathEnabled(true)
        setInternalJmespathMode('highlight')
      }
    }
  }, [jmespathState, onJMESPathStateChange, internalJmespathEnabled, internalJmespathMode])

  const toggleFilterMode = useCallback(() => {
    if (onJMESPathStateChange) {
      const enabled = !(jmespathState?.enabled && jmespathState?.mode === 'filter')
      onJMESPathStateChange({ enabled, query: jmespathState?.query ?? '', mode: 'filter' })
    } else {
      if (internalJmespathEnabled && internalJmespathMode === 'filter') {
        setInternalJmespathEnabled(false)
      } else {
        setInternalJmespathEnabled(true)
        setInternalJmespathMode('filter')
      }
    }
  }, [jmespathState, onJMESPathStateChange, internalJmespathEnabled, internalJmespathMode])

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
    if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
      e.preventDefault()
      toggleHighlightMode()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
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
    }
  }

  // Apply a history value via execCommand so it enters the browser's native undo stack,
  // letting Ctrl/Cmd+Z naturally undo history navigation.
  const applyHistoryValue = useCallback((query: string) => {
    const input = activeInputRef.current
    if (input) {
      input.focus()
      input.select()
      document.execCommand('insertText', false, query)
    }
  }, [])

  const addToHistory = useCallback((query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setJmespathHistory((prev) => {
      const filtered = prev.filter((h) => h !== trimmed)
      return [trimmed, ...filtered].slice(0, 10)
    })
  }, [])

  // Add to history when query changes externally (e.g. cmd+click from JSON viewer)
  useEffect(() => {
    if (prevQueryRef.current !== jmespathQuery && !isInputFocusedRef.current) {
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

  const renderContent = (unlimitedHeight = false) => {
    // If JMESPath filter mode and we have filtered content
    if (jmespathEnabled && jmespathMode === 'filter' && filteredContent !== null) {
      try {
        JSON.parse(filteredContent)
        return (
          <JsonResponseViewer
            jsonString={filteredContent}
            responseSchema={undefined}
            validationErrors={undefined}
            onJmespathSelect={setJmespathQuery}
          />
        )
      } catch {
        return filteredContent
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
      <Button
        variant="outline"
        size="sm"
        className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
        onClick={handleDownload}
        title="Download"
      >
        <Download className="h-3.5 w-3.5" />
        {showText && <span>Download</span>}
      </Button>
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
          onChange={(e) => {
            setHistoryIndex(-1)
            setJmespathQuery(e.target.value)
          }}
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
            if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
              e.preventDefault()
              toggleHighlightMode()
              return
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
              e.preventDefault()
              toggleFilterMode()
              return
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '8') {
              e.preventDefault()
              applyWildcard()
              return
            }
            if (e.key === 'Enter') {
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
                applyHistoryValue(savedQueryRef.current)
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
              applyHistoryValue(jmespathHistory[newIndex])
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (historyIndex === -1) return
              const newIndex = historyIndex - 1
              setHistoryIndex(newIndex)
              applyHistoryValue(newIndex === -1 ? savedQueryRef.current : jmespathHistory[newIndex])
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
                  applyHistoryValue(expr)
                  setHistoryIndex(-1)
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

  // Calculate line count
  const displayContent =
    jmespathEnabled && jmespathMode === 'filter' && filteredContent !== null
      ? filteredContent
      : content
  const lineCount = displayContent.split('\n').length

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
            <span>Ln {lineCount}</span>
            <span>{displayContent.length} chars</span>
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
              <span>Ln {lineCount}</span>
              <span>{displayContent.length} chars</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hotkey info dialog */}
      <Dialog open={showHotkeyInfo} onOpenChange={setShowHotkeyInfo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">JSON Viewer</p>
              <div className="space-y-0.5">
                {([
                  ['⌘ H', 'Toggle Highlight Mode'],
                  ['⌘ P', 'Toggle Filter Mode'],
                  ['⌘ 8', 'Wildcard array indices ([0] → [*])'],
                  ['⌘ A', 'Select all content'],
                  ['⌘ Click', 'Use value as JMESPath expression'],
                ] as [string, string][]).map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                    <span className="text-muted-foreground">{desc}</span>
                    <kbd className="ml-4 shrink-0 px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">JMESPath Input</p>
              <div className="space-y-0.5">
                {([
                  ['↑ / ↓', 'Browse query history'],
                  ['Enter', 'Save query to history'],
                  ['Esc', 'Close history / revert query'],
                  ['Double-click', 'Show query history'],
                ] as [string, string][]).map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                    <span className="text-muted-foreground">{desc}</span>
                    <kbd className="ml-4 shrink-0 px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Viewer Controls</p>
              <div className="space-y-0.5">
                {([
                  ['↔', 'Expand to bottom panel'],
                  ['⤢', 'Maximize / fullscreen'],
                  ['⌘ H', 'Show this help (when viewer not focused)'],
                ] as [string, string][]).map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                    <span className="text-muted-foreground">{desc}</span>
                    <kbd className="ml-4 shrink-0 px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
