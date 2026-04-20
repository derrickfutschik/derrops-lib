/**
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/views/models-tab.md
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
import { useModelsTab } from '@/hooks/useModelsTab'
import {
  selectModelsTabState,
  setModelsQuery,
  setModelsUsedInFilter,
  setTabPage,
  setTabSort,
  showAllTabColumns,
  toggleTabColumn,
} from '@/store/apiTabsSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { ModelHit } from '@/types/apiTabs'
import { useState } from 'react'
import { ModelDetailPanel } from './ModelDetailPanel'
import { SortableColHeader } from './SortableColHeader'
import { TabTableFooter } from './TabTableFooter'

interface ModelsTabProps {
  apiId: string
}

const COLUMNS = [
  { field: 'name', label: 'Name', sortable: true },
  { field: 'schemaType', label: 'Type', sortable: true },
  { field: 'usedInText', label: 'Used in', sortable: false },
  { field: 'description', label: 'Description', sortable: false },
]

const USED_IN_CLASSES: Record<string, string> = {
  request: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  response: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

const USED_IN_OPTIONS = ['request', 'response']

export function ModelsTab({ apiId }: ModelsTabProps) {
  const dispatch = useAppDispatch()
  const { sort, hiddenColumns, page, query, usedInFilter } = useAppSelector(selectModelsTabState)
  const { data, isLoading } = useModelsTab(apiId)
  const [selected, setSelected] = useState<ModelHit | null>(null)

  const from = page * PAGE_SIZE
  const visible = COLUMNS.filter((c) => !hiddenColumns.includes(c.field))
  const hasFilter = !!(query || usedInFilter)

  function handleSort(field: string) {
    const direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc'
    dispatch(setTabSort({ tab: 'models', field, direction }))
  }

  function handleHide(field: string) {
    dispatch(toggleTabColumn({ tab: 'models', column: field }))
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Loading models…</div>
  }

  if (!data || (data.hits.length === 0 && !hasFilter)) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Models will appear here after the spec is indexed.
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search models…"
          value={query}
          onChange={(e) => dispatch(setModelsQuery(e.target.value))}
          className="max-w-xs h-8 text-sm"
        />
        <div className="flex gap-1">
          {USED_IN_OPTIONS.map((opt) => (
            <Button
              key={opt}
              variant={usedInFilter === opt ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs capitalize"
              onClick={() => dispatch(setModelsUsedInFilter(usedInFilter === opt ? null : opt))}
            >
              {opt}
            </Button>
          ))}
        </div>
      </div>

      {hiddenColumns.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{hiddenColumns.length} column(s) hidden</span>
          <button
            className="underline hover:text-foreground"
            onClick={() => dispatch(showAllTabColumns({ tab: 'models' }))}
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
          {data.hits.map((model, i) => (
            <TableRow
              key={model.id}
              className="cursor-pointer hover:bg-secondary/50"
              onClick={() => setSelected(model)}
            >
              <TableCell className="font-mono text-xs text-muted-foreground">{from + i}</TableCell>
              {!hiddenColumns.includes('name') && (
                <TableCell className="font-medium text-sm">{model.name}</TableCell>
              )}
              {!hiddenColumns.includes('schemaType') && (
                <TableCell>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {model.schemaType}
                  </Badge>
                </TableCell>
              )}
              {!hiddenColumns.includes('usedInText') && (
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {model.usedInText
                      ?.split(' ')
                      .filter(Boolean)
                      .map((use) => (
                        <span
                          key={use}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            USED_IN_CLASSES[use] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {use}
                        </span>
                      ))}
                  </div>
                </TableCell>
              )}
              {!hiddenColumns.includes('description') && (
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                  {model.description}
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
        entity="models"
        hasFilter={hasFilter}
        onPrev={() => dispatch(setTabPage({ tab: 'models', page: page - 1 }))}
        onNext={() => dispatch(setTabPage({ tab: 'models', page: page + 1 }))}
      />

      <ModelDetailPanel
        model={
          selected
            ? {
                name: selected.name,
                schemaType: selected.schemaType,
                usedInText: selected.usedInText,
                description: selected.description,
                propertiesText: selected.propertiesText,
              }
            : null
        }
        onClose={() => setSelected(null)}
      />
    </>
  )
}
