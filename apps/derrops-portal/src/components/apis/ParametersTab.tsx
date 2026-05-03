/**
 * @designDoc apps/derrops-docs/internal/platform/design/openapi-indexer/views/parameters-tab.md
 */
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
import { useParametersTab } from '@/hooks/useParametersTab'
import { cn } from '@/lib/utils'
import {
  selectParametersTabState,
  setParametersLocationFilter,
  setParametersQuery,
  setTabPage,
  setTabSort,
  showAllTabColumns,
  toggleTabColumn,
} from '@/store/apiTabsSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { SortableColHeader } from './SortableColHeader'
import { TabTableFooter } from './TabTableFooter'

interface ParametersTabProps {
  apiId: string
}

const COLUMNS = [
  { field: 'name', label: 'Name', sortable: true },
  { field: 'location', label: 'Location', sortable: true },
  { field: 'schemaType', label: 'Type', sortable: false },
  { field: 'required', label: 'Req.', sortable: false },
  { field: 'description', label: 'Description', sortable: false },
]

const LOCATION_CLASSES: Record<string, string> = {
  path: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  query: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  header: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  cookie: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

const LOCATIONS = ['path', 'query', 'header', 'cookie']

export function ParametersTab({ apiId }: ParametersTabProps) {
  const dispatch = useAppDispatch()
  const { sort, hiddenColumns, page, query, locationFilter } =
    useAppSelector(selectParametersTabState)
  const { data, isLoading } = useParametersTab(apiId)

  const from = page * PAGE_SIZE
  const visible = COLUMNS.filter((c) => !hiddenColumns.includes(c.field))
  const hasFilter = !!(query || locationFilter)

  function handleSort(field: string) {
    const direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc'
    dispatch(setTabSort({ tab: 'parameters', field, direction }))
  }

  function handleHide(field: string) {
    dispatch(toggleTabColumn({ tab: 'parameters', column: field }))
  }

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">Loading parameters…</div>
    )
  }

  if (!data || (data.hits.length === 0 && !hasFilter)) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Parameters will appear here after the spec is indexed.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search parameters…"
          value={query}
          onChange={(e) => dispatch(setParametersQuery(e.target.value))}
          className="max-w-xs h-8 text-sm"
        />
        <div className="flex gap-1">
          {LOCATIONS.map((loc) => (
            <Button
              key={loc}
              variant={locationFilter === loc ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() =>
                dispatch(setParametersLocationFilter(locationFilter === loc ? null : loc))
              }
            >
              {loc}
            </Button>
          ))}
        </div>
      </div>

      {hiddenColumns.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{hiddenColumns.length} column(s) hidden</span>
          <button
            className="underline hover:text-foreground"
            onClick={() => dispatch(showAllTabColumns({ tab: 'parameters' }))}
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
          {data.hits.map((p, i) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{from + i}</TableCell>
              {!hiddenColumns.includes('name') && (
                <TableCell className="font-mono text-xs">{p.name}</TableCell>
              )}
              {!hiddenColumns.includes('location') && (
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                      LOCATION_CLASSES[p.location] ?? 'bg-gray-100 text-gray-700',
                    )}
                  >
                    {p.location}
                  </span>
                </TableCell>
              )}
              {!hiddenColumns.includes('schemaType') && (
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {[p.schemaType, p.schemaFormat].filter(Boolean).join(' ') || '—'}
                </TableCell>
              )}
              {!hiddenColumns.includes('required') && (
                <TableCell className="text-xs">{p.required ? '✓' : ''}</TableCell>
              )}
              {!hiddenColumns.includes('description') && (
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                  {p.deprecated && <span className="text-amber-600 mr-1">⚠</span>}
                  {p.description}
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
        entity="parameters"
        hasFilter={hasFilter}
        onPrev={() => dispatch(setTabPage({ tab: 'parameters', page: page - 1 }))}
        onNext={() => dispatch(setTabPage({ tab: 'parameters', page: page + 1 }))}
      />
    </div>
  )
}
