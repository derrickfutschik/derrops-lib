/**
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/views/operations-tab.md
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PAGE_SIZE } from '@/config'
import { useOperationsTab } from '@/hooks/useOperationsTab'
import {
  selectOperationsTabState,
  setOperationsMethodFilter,
  setOperationsQuery,
  setOperationsTagFilter,
  setTabPage,
  setTabSort,
  showAllTabColumns,
  toggleTabColumn,
} from '@/store/apiTabsSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { OperationHit } from '@/types/apiTabs'
import { useState } from 'react'
import { MethodBadge } from './MethodBadge'
import { OperationDetailPanel } from './OperationDetailPanel'
import { SortableColHeader } from './SortableColHeader'
import { TabTableFooter } from './TabTableFooter'

interface OperationsTabProps {
  apiId: string
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const COLUMNS = [
  { field: 'method', label: 'Method', sortable: true },
  { field: 'path', label: 'Path', sortable: true },
  { field: 'summary', label: 'Summary', sortable: true },
  { field: 'tagsText', label: 'Tags', sortable: false },
]

export function OperationsTab({ apiId }: OperationsTabProps) {
  const dispatch = useAppDispatch()
  const { sort, hiddenColumns, page, query, methodFilter, tagFilter } =
    useAppSelector(selectOperationsTabState)
  const { data, isLoading } = useOperationsTab(apiId)
  const [selected, setSelected] = useState<OperationHit | null>(null)

  const from = page * PAGE_SIZE
  const visible = COLUMNS.filter((c) => !hiddenColumns.includes(c.field))
  const hasFilter = !!(query || methodFilter.length || tagFilter)

  function handleSort(field: string) {
    const direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc'
    dispatch(setTabSort({ tab: 'operations', field, direction }))
  }

  function handleHide(field: string) {
    dispatch(toggleTabColumn({ tab: 'operations', column: field }))
  }

  function toggleMethod(method: string) {
    const next = methodFilter.includes(method)
      ? methodFilter.filter((m) => m !== method)
      : [...methodFilter, method]
    dispatch(setOperationsMethodFilter(next))
  }

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">Loading operations…</div>
    )
  }

  if (!data || (data.hits.length === 0 && !hasFilter)) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Operations will appear here after the spec is indexed.
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search operations…"
          value={query}
          onChange={(e) => dispatch(setOperationsQuery(e.target.value))}
          className="max-w-xs h-8 text-sm"
        />
        <div className="flex gap-1">
          {HTTP_METHODS.map((m) => (
            <Button
              key={m}
              variant={methodFilter.includes(m) ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => toggleMethod(m)}
            >
              {m}
            </Button>
          ))}
        </div>
      </div>

      {hiddenColumns.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{hiddenColumns.length} column(s) hidden</span>
          <button
            className="underline hover:text-foreground"
            onClick={() => dispatch(showAllTabColumns({ tab: 'operations' }))}
          >
            Show all
          </button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 text-muted-foreground font-mono">#</TableHead>
            {visible.map((col) =>
              col.sortable ? (
                <SortableColHeader
                  key={col.field}
                  field={col.field}
                  label={col.label}
                  activeField={sort.field}
                  activeDirection={sort.direction}
                  onSort={handleSort}
                  onHide={handleHide}
                />
              ) : (
                <TableHead key={col.field}>{col.label}</TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.hits.map((op, i) => (
            <TableRow
              key={op.id}
              className="cursor-pointer hover:bg-secondary/50"
              onClick={() => setSelected(op)}
            >
              <TableCell className="font-mono text-xs text-muted-foreground">{from + i}</TableCell>
              {!hiddenColumns.includes('method') && (
                <TableCell>
                  <MethodBadge method={op.method} />
                </TableCell>
              )}
              {!hiddenColumns.includes('path') && (
                <TableCell className="font-mono text-xs">{op.path}</TableCell>
              )}
              {!hiddenColumns.includes('summary') && (
                <TableCell className="text-sm">
                  {op.deprecated && (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-300 mr-1.5 text-xs"
                    >
                      ⚠ deprecated
                    </Badge>
                  )}
                  {op.summary}
                </TableCell>
              )}
              {!hiddenColumns.includes('tagsText') && (
                <TableCell>
                  {op.tagsText
                    ?.split(' ')
                    .filter(Boolean)
                    .map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="mr-1 text-xs cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          dispatch(setOperationsTagFilter(tagFilter === tag ? null : tag))
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TabTableFooter
        total={data.total}
        from={from}
        page={page}
        entity="operations"
        hasFilter={hasFilter}
        onPrev={() => dispatch(setTabPage({ tab: 'operations', page: page - 1 }))}
        onNext={() => dispatch(setTabPage({ tab: 'operations', page: page + 1 }))}
      />

      <OperationDetailPanel
        operation={
          selected
            ? {
                method: selected.method,
                path: selected.path,
                summary: selected.summary,
                operationId: selected.operationId,
                tagsText: selected.tagsText,
                description: selected.description,
                pathKey: selected.pathKey,
                deprecated: selected.deprecated,
              }
            : null
        }
        onClose={() => setSelected(null)}
      />
    </>
  )
}
