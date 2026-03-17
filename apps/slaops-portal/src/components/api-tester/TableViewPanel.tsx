import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import alasql from 'alasql'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  EyeOff,
  FileCode,
  Filter,
  Highlighter,
} from 'lucide-react'
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { type JoiningContext, type JoinColumnCandidate } from './joining-utils'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  selectTableState,
  selectActiveSortColumn,
  selectHiddenColumnIds,
  setSqlQuery as setSqlQueryRedux,
  setSqlMode as setSqlModeRedux,
  setJoinColumn,
  reconcileColumns,
  toggleColumnHidden,
  showAllColumns,
  setColumnSort,
} from '@/store/responseViewerSlice'

interface TableViewPanelProps {
  /** The effective content (jmespath filtered or raw) */
  displayContent: string
  joiningContext: JoiningContext | null
  joinColumnCandidates: JoinColumnCandidate[]
  /** Ref for parent copy/download to access computed table data */
  tableDataRef: React.MutableRefObject<{ columns: string[]; rows: string[][] } | null>
  /** Ref for parent copy/download to access SQL result data */
  sqlResultRef: React.MutableRefObject<{ columns: string[]; rows: string[][] } | null>
}

export function TableViewPanel({
  displayContent,
  joiningContext,
  joinColumnCandidates,
  tableDataRef,
  sqlResultRef,
}: TableViewPanelProps) {
  const dispatch = useAppDispatch()
  const tableState = useAppSelector(selectTableState)
  const activeSortColumn = useAppSelector(selectActiveSortColumn)
  const hiddenColumnIds = useAppSelector(selectHiddenColumnIds)

  const hiddenColumns = hiddenColumnIds

  const sqlQuery = tableState.sqlQuery
  const setSqlQuery = (q: string) => dispatch(setSqlQueryRedux(q))
  const sqlMode = tableState.sqlMode
  const setSqlMode = (m: 'filter' | 'highlight') => dispatch(setSqlModeRedux(m))

  // Join column from Redux (first join path)
  const joinColumn = tableState.joinColumn

  const [sqlError, setSqlError] = useState<string | null>(null)
  const [sqlHistory, setSqlHistory] = useState<string[]>([])
  const [sqlHistoryIndex, setSqlHistoryIndex] = useState(-1)
  const [showSqlHistory, setShowSqlHistory] = useState(false)
  const [joiningEnabled, setJoiningEnabled] = useState(false)
  const [additionalJoinPaths, setAdditionalJoinPaths] = useState<(string | null)[]>([])
  const [joinSelectOpen, setJoinSelectOpen] = useState<number | null>(null)

  const savedSqlRef = useRef('')
  const sqlInputRef = useRef<HTMLInputElement>(null)

  // Unified selectedJoinPaths: [joinColumn, ...additionalJoinPaths]
  const selectedJoinPaths = useMemo(
    () => [joinColumn, ...additionalJoinPaths],
    [joinColumn, additionalJoinPaths],
  )

  const setSelectedJoinPaths = (updater: ((prev: (string | null)[]) => (string | null)[])) => {
    const current = [joinColumn, ...additionalJoinPaths]
    const next = updater(current)
    if (next[0] !== joinColumn) {
      dispatch(setJoinColumn(next[0] ?? null))
    }
    setAdditionalJoinPaths(next.slice(1))
  }

  // Parse table data from displayContent (JSON array of objects or primitives, or CSV string)
  const tableData = useMemo(() => {
    // Helper: build enhanced columns/rows when joining is active, applying any custom join path selection
    const applyJoining = (baseColumns: string[], baseRows: string[][]): { columns: string[]; rows: string[][] } | null => {
      if (!joiningEnabled || !joiningContext || joiningContext.joiningColumns.length === 0) return null
      // Build effective column names: custom selections get a SQL-safe "join_column" name
      // that doesn't conflict with any existing data column or previously assigned join column.
      const effectiveJoinCols: string[] = []
      for (let j = 0; j < joiningContext.joiningColumns.length; j++) {
        const path = selectedJoinPaths[j] ?? null
        if (!path || path === '__default__') {
          effectiveJoinCols.push(joiningContext.joiningColumns[j])
          continue
        }
        const cand = joinColumnCandidates.find((c) => c.path === path)
        if (!cand) {
          effectiveJoinCols.push(joiningContext.joiningColumns[j])
          continue
        }
        const taken = new Set([...baseColumns, ...effectiveJoinCols])
        let name = 'join_column'
        if (taken.has(name)) {
          let suffix = 2
          while (taken.has(`join_column_${suffix}`)) suffix++
          name = `join_column_${suffix}`
        }
        effectiveJoinCols.push(name)
      }
      const enhancedColumns = [...effectiveJoinCols, ...baseColumns]
      const enhancedRows = baseRows.map((row, i) => {
        const joinVals = joiningContext.joiningColumns.map((_, j) => {
          const defaultVal = joiningContext.rowIndices[i]?.[j] ?? ''
          const path = selectedJoinPaths[j] ?? null
          if (!path || path === '__default__') return defaultVal
          const cand = joinColumnCandidates.find((c) => c.path === path)
          if (!cand) return defaultVal
          const elemIdx = parseInt(defaultVal, 10)
          return !isNaN(elemIdx) ? (cand.values[elemIdx] ?? '') : ''
        })
        return [...joinVals, ...row]
      })
      return { columns: enhancedColumns, rows: enhancedRows }
    }

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
          return applyJoining(columns, rows) ?? { columns, rows }
        }
        // Array of primitives
        const rows = parsed.map((v: any) => [v === null || v === undefined ? '' : String(v)])
        return applyJoining(['value'], rows) ?? { columns: ['value'], rows }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayContent, joiningEnabled, joiningContext, selectedJoinPaths, joinColumnCandidates])

  // Keep parent refs in sync for copy/download
  tableDataRef.current = tableData
  sqlResultRef.current = null // reset before sqlResult useMemo below

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
  const sqlResult = useMemo(() => {
    if (!sqlQuery.trim() || !tableData) return null
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
  }, [sqlQuery, normalizedSqlQuery, tableData, joiningContext])

  // Keep parent sqlResultRef in sync
  sqlResultRef.current = sqlResult

  // Compute highlight info for SQL highlight mode
  const sqlHighlightInfo = useMemo(() => {
    if (!sqlQuery.trim() || !tableData || sqlMode !== 'highlight') {
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
  }, [sqlQuery, normalizedSqlQuery, tableData, sqlMode, joiningContext])

  const tableDuplicateCount = useMemo(() => {
    if (!tableData) return 0
    const seen = new Set<string>()
    let dupes = 0
    for (const row of tableData.rows) {
      const key = JSON.stringify(row)
      if (seen.has(key)) dupes++
      else seen.add(key)
    }
    return dupes
  }, [tableData])

  const { sortedRows, sortedOriginalIndices } = useMemo(() => {
    const baseColumns = (sqlMode === 'highlight' ? tableData : (sqlResult || tableData))?.columns ?? []
    const baseRows = (sqlMode === 'highlight' ? tableData?.rows : (sqlResult ? sqlResult.rows : tableData?.rows)) ?? []
    if (!baseRows.length || !activeSortColumn) {
      return { sortedRows: baseRows, sortedOriginalIndices: baseRows.map((_, i) => i) }
    }
    const col = baseColumns.indexOf(activeSortColumn.id)
    if (col === -1) {
      return { sortedRows: baseRows, sortedOriginalIndices: baseRows.map((_, i) => i) }
    }
    const sortDir = activeSortColumn.direction
    const indexed = baseRows.map((row, i) => ({ row, origIdx: i }))
    const sorted = [...indexed].sort((a, b) => {
      const aVal = a.row[col] ?? ''
      const bVal = b.row[col] ?? ''
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      const isNumeric = aVal !== '' && bVal !== '' && !isNaN(aNum) && !isNaN(bNum)
      const cmp = isNumeric ? aNum - bNum : String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return { sortedRows: sorted.map(s => s.row), sortedOriginalIndices: sorted.map(s => s.origIdx) }
  }, [tableData, sqlResult, sqlMode, activeSortColumn])

  const handleColumnSort = (colIndex: number, colName: string) => {
    if (activeSortColumn?.id === colName) {
      dispatch(setColumnSort({ id: colName, direction: activeSortColumn.direction === 'asc' ? 'desc' : 'asc' }))
    } else {
      dispatch(setColumnSort({ id: colName, direction: 'asc' }))
    }
  }

  // Auto-enable joining when context becomes available, auto-disable when it disappears
  useEffect(() => {
    setJoiningEnabled(joiningContext !== null && joiningContext.joiningColumns.length > 0)
  }, [joiningContext])

  // Reset sort column when joining enabled state changes to avoid index shift bugs
  useEffect(() => {
    if (activeSortColumn) {
      dispatch(setColumnSort({ id: activeSortColumn.id, direction: null }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joiningEnabled])

  // When tableData columns change, reconcile Redux column prefs
  useEffect(() => {
    if (tableData?.columns) {
      dispatch(reconcileColumns(tableData.columns))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableData?.columns.join('\0')])

  // When candidates change, preserve any selection that is still valid; fall back to default otherwise
  useEffect(() => {
    setSelectedJoinPaths((prev) =>
      prev.map((path) => {
        if (!path || path === '__default__') return path
        return joinColumnCandidates.some((c) => c.path === path) ? path : null
      }),
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinColumnCandidates])

  const addToSqlHistory = useCallback((query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setSqlHistory(prev => {
      const filtered = prev.filter(h => h !== trimmed)
      return [trimmed, ...filtered].slice(0, 20)
    })
  }, [])

  const handleCellClick = useCallback((colName: string, value: string) => (e: React.MouseEvent) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlQuery, addToSqlHistory])

  if (!tableData) {
    return <span className="text-muted-foreground text-sm">No tabular data available</span>
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

  const joiningColumnsRow = () => {
    if (!joiningContext) return null
    return (
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={joiningEnabled} onCheckedChange={setJoiningEnabled} className="scale-75" />
          <Label className="text-xs font-medium text-muted-foreground">Join</Label>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {joiningContext.joiningColumns.map((col, j) => {
            // Only the first joining column gets the candidate combobox for now
            const candidates = j === 0 ? joinColumnCandidates : []
            const selectedPath = selectedJoinPaths[j] ?? null

            if (candidates.length <= 1) {
              // No alternatives — show plain badge
              return (
                <span key={j} className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-muted-foreground">
                  {col}
                </span>
              )
            }

            return (
              <Select
                key={j}
                value={selectedPath ?? '__default__'}
                open={joinSelectOpen === j}
                onOpenChange={(open) => setJoinSelectOpen(open ? j : null)}
                onValueChange={(value) => {
                  setSelectedJoinPaths((prev) => {
                    const next = [...prev]
                    next[j] = value
                    return next
                  })
                }}
              >
                <SelectTrigger
                  className="h-6 w-auto gap-1 px-1.5 text-xs font-mono border-none bg-muted hover:bg-muted/70 focus:ring-0 focus:ring-offset-0 [&>svg:last-child]:h-3 [&>svg:last-child]:w-3 max-w-[280px]"
                  title="Choose join column"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((cand) => (
                    <SelectItem key={cand.path} value={cand.path} textValue={cand.label} className="text-xs font-mono">
                      <div className="flex flex-col">
                        <span>{cand.label}</span>
                        {joinSelectOpen === j && !cand.isDefault && cand.values.length > 0 && (
                          <span className="text-muted-foreground text-[10px]">
                            {cand.values.slice(0, 3).join(', ')}{cand.values.length > 3 ? '…' : ''}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          })}
        </div>
      </div>
    )
  }

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
              onClick={() => dispatch(showAllColumns())}
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
                  onClick={() => handleColumnSort(i, col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col}
                    {activeSortColumn?.id === col ? (
                      activeSortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                    <button
                      className="opacity-0 group-hover/col:opacity-100 ml-0.5 text-muted-foreground hover:text-destructive transition-opacity"
                      title="Hide column"
                      onClick={(e) => {
                        e.stopPropagation()
                        dispatch(toggleColumnHidden(col))
                        // Clear sort for this column when hiding
                        dispatch(setColumnSort({ id: col, direction: null }))
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
      {/* Table status bar */}
      <div className="flex items-center justify-end px-3 py-1.5 border-t border-border bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-4">
          {(() => {
            const total = tableData.rows.length
            const selected = sqlQuery.trim()
              ? sqlMode === 'filter' ? (sqlResult?.rows.length ?? total) : sqlHighlightInfo.matchedRowIndices.size
              : null
            return <><span>{selected !== null ? `${selected}/${total}` : total.toLocaleString()} rows</span>{tableDuplicateCount > 0 && <span className="text-red-400">{tableDuplicateCount} duplicate{tableDuplicateCount !== 1 ? 's' : ''}</span>}</>
          })()}
        </div>
      </div>
    </div>
  )
}
