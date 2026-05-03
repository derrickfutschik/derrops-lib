/**
 * @designDoc apps/derrops-docs/internal/platform/design/openapi-indexer/views/servers-tab.md
 */
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PAGE_SIZE } from '@/config'
import { useServersTab } from '@/hooks/useServersTab'
import {
  selectServersTabState,
  setTabPage,
  setTabSort,
  showAllTabColumns,
  toggleTabColumn,
} from '@/store/apiTabsSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { SortableColHeader } from './SortableColHeader'
import { TabTableFooter } from './TabTableFooter'

interface ServersTabProps {
  apiId: string
}

const COLUMNS = [
  { field: 'rawUrl', label: 'URL', sortable: true },
  { field: 'hostShape', label: 'Host shape', sortable: true },
  { field: 'basePath', label: 'Base path', sortable: true },
  { field: 'scheme', label: 'Scheme', sortable: true },
]

const SCHEME_CLASSES: Record<string, string> = {
  https: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0',
  http: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-0',
}

export function ServersTab({ apiId }: ServersTabProps) {
  const dispatch = useAppDispatch()
  const { sort, hiddenColumns, page } = useAppSelector(selectServersTabState)
  const { data, isLoading } = useServersTab(apiId)

  const from = page * PAGE_SIZE
  const visible = COLUMNS.filter((c) => !hiddenColumns.includes(c.field))

  function handleSort(field: string) {
    const direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc'
    dispatch(setTabSort({ tab: 'servers', field, direction }))
  }

  function handleHide(field: string) {
    dispatch(toggleTabColumn({ tab: 'servers', column: field }))
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Loading servers…</div>
  }

  if (!data || data.hits.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Servers will appear here after the spec is indexed.
      </div>
    )
  }

  return (
    <div>
      {hiddenColumns.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{hiddenColumns.length} column(s) hidden</span>
          <button
            className="underline hover:text-foreground"
            onClick={() => dispatch(showAllTabColumns({ tab: 'servers' }))}
          >
            Show all
          </button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 text-muted-foreground font-mono">#</TableHead>
            {visible.map((col) => (
              <SortableColHeader
                key={col.field}
                field={col.field}
                label={col.label}
                activeField={sort.field}
                activeDirection={sort.direction}
                onSort={handleSort}
                onHide={handleHide}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.hits.map((s, i) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{from + i}</TableCell>
              {!hiddenColumns.includes('rawUrl') && (
                <TableCell className="font-mono text-xs">{s.rawUrl}</TableCell>
              )}
              {!hiddenColumns.includes('hostShape') && (
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {s.hostShape || '—'}
                </TableCell>
              )}
              {!hiddenColumns.includes('basePath') && (
                <TableCell className="font-mono text-xs">{s.basePath || '/'}</TableCell>
              )}
              {!hiddenColumns.includes('scheme') && (
                <TableCell>
                  <Badge
                    className={`text-xs ${SCHEME_CLASSES[s.scheme] ?? ''}`}
                    variant="secondary"
                  >
                    {s.scheme || '—'}
                  </Badge>
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
        entity="servers"
        onPrev={() => dispatch(setTabPage({ tab: 'servers', page: page - 1 }))}
        onNext={() => dispatch(setTabPage({ tab: 'servers', page: page + 1 }))}
      />
    </div>
  )
}
