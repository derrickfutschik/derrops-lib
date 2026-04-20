/**
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/views/versions-tab.md
 */
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  selectVersionsTabState,
  setSelectedVersion,
  setTabSort,
  setTabPage,
  toggleTabColumn,
  showAllTabColumns,
} from '@/store/apiTabsSlice'
import { useVersionsTab } from '@/hooks/useVersionsTab'
import { SortableColHeader } from './SortableColHeader'
import { TabTableFooter } from './TabTableFooter'
import { PAGE_SIZE } from '@/config'

interface VersionsTabProps {
  apiId: string
}

const COLUMNS = [
  { field: 'version', label: 'Version', sortable: true },
  { field: 'specVersion', label: 'Spec', sortable: true },
  { field: 'operationCount', label: 'Operations', sortable: true },
  { field: 'serverCount', label: 'Servers', sortable: true },
  { field: 'parameterCount', label: 'Parameters', sortable: true },
  { field: 'modelCount', label: 'Models', sortable: true },
  { field: 'fileSize', label: 'Size', sortable: true },
  { field: 'fileFormat', label: 'Format', sortable: false },
  { field: 'indexedAt', label: 'Indexed At', sortable: true },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function VersionsTab({ apiId }: VersionsTabProps) {
  const dispatch = useAppDispatch()
  const { sort, hiddenColumns, page } = useAppSelector(selectVersionsTabState)
  const { data, isLoading } = useVersionsTab(apiId)

  const from = page * PAGE_SIZE
  const visible = COLUMNS.filter((c) => !hiddenColumns.includes(c.field))

  function handleSort(field: string) {
    const direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc'
    dispatch(setTabSort({ tab: 'versions', field, direction }))
  }

  function handleHide(field: string) {
    dispatch(toggleTabColumn({ tab: 'versions', column: field }))
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Loading versions…</div>
  }

  if (!data || data.hits.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Version history will appear here after the spec is indexed.
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
            onClick={() => dispatch(showAllTabColumns({ tab: 'versions' }))}
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
          {data.hits.map((v, i) => (
            <TableRow
              key={v.id}
              className="cursor-pointer hover:bg-secondary/50"
              onClick={() => dispatch(setSelectedVersion(v.latest ? null : v.version))}
            >
              <TableCell className="font-mono text-xs text-muted-foreground">{from + i}</TableCell>
              {!hiddenColumns.includes('version') && (
                <TableCell className="font-mono text-sm">
                  {v.version}
                  {v.latest && (
                    <Badge className="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">
                      Latest
                    </Badge>
                  )}
                </TableCell>
              )}
              {!hiddenColumns.includes('specVersion') && (
                <TableCell className="text-xs text-muted-foreground">{v.specVersion}</TableCell>
              )}
              {!hiddenColumns.includes('operationCount') && (
                <TableCell className="text-xs">{v.operationCount}</TableCell>
              )}
              {!hiddenColumns.includes('serverCount') && (
                <TableCell className="text-xs">{v.serverCount}</TableCell>
              )}
              {!hiddenColumns.includes('parameterCount') && (
                <TableCell className="text-xs">{v.parameterCount}</TableCell>
              )}
              {!hiddenColumns.includes('modelCount') && (
                <TableCell className="text-xs">{v.modelCount}</TableCell>
              )}
              {!hiddenColumns.includes('fileSize') && (
                <TableCell className="text-xs text-muted-foreground">{formatBytes(v.fileSize)}</TableCell>
              )}
              {!hiddenColumns.includes('fileFormat') && (
                <TableCell>
                  <Badge variant="secondary" className="text-xs font-mono uppercase">
                    {v.fileFormat}
                  </Badge>
                </TableCell>
              )}
              {!hiddenColumns.includes('indexedAt') && (
                <TableCell className="text-xs text-muted-foreground">{formatDate(v.indexedAt)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TabTableFooter
        total={data.total}
        from={from}
        page={page}
        entity="versions"
        onPrev={() => dispatch(setTabPage({ tab: 'versions', page: page - 1 }))}
        onNext={() => dispatch(setTabPage({ tab: 'versions', page: page + 1 }))}
      />
    </div>
  )
}
