import React from 'react'

type ViewMode = 'json' | 'markdown' | 'table'

type JsonStats =
  | { type: 'array'; count: number; totalKeys: number; depth: number; flattenedCount: number }
  | { type: 'object'; keys: number; totalKeys: number; depth: number }
  | null

interface StatusRibbonProps {
  viewMode: ViewMode
  jmespathError: string | null
  jsonStats: JsonStats
  duplicateCount: number
  lineCount: number
  displayContentLength: number
  filterPercent: number | null
  className?: string
}

export function StatusRibbon({
  viewMode,
  jmespathError,
  jsonStats,
  duplicateCount,
  lineCount,
  displayContentLength,
  filterPercent,
  className = 'px-3 py-1.5',
}: StatusRibbonProps) {
  return (
    <div className={`flex items-center justify-between ${className} border-t border-border bg-muted/30 text-xs text-muted-foreground`}>
      <div>{jmespathError && <span className="text-destructive">{jmespathError}</span>}</div>
      <div className="flex items-center gap-4">
        {viewMode === 'json' && (
          <>
            {jsonStats?.type === 'array' && (
              <span>
                {jsonStats.count.toLocaleString()} items
                {jsonStats.flattenedCount !== jsonStats.count && ` (${jsonStats.flattenedCount.toLocaleString()} flattened)`}
              </span>
            )}
            {jsonStats?.type === 'array' && <span>depth {jsonStats.depth}</span>}
            {duplicateCount > 0 && <span className="text-red-400">{duplicateCount} duplicates</span>}
            {jsonStats && jsonStats.totalKeys > 0 && <span>{jsonStats.totalKeys.toLocaleString()} total keys</span>}
            {jsonStats?.type === 'object' && (
              <>
                <span>{jsonStats.keys.toLocaleString()} keys</span>
                <span>depth {jsonStats.depth}</span>
              </>
            )}
            <span>Ln {lineCount.toLocaleString()}</span>
            <span>{displayContentLength.toLocaleString()} chars</span>
            {filterPercent !== null && <span className="text-primary">{filterPercent}% of response</span>}
          </>
        )}
        {viewMode === 'markdown' && (
          <>
            <span>Ln {lineCount.toLocaleString()}</span>
            <span>{displayContentLength.toLocaleString()} chars</span>
          </>
        )}
        {/* table stats are shown inside TableViewPanel */}
      </div>
    </div>
  )
}
