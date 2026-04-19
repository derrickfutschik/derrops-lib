import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectParamsQuery, setParamsQuery } from '@/store/apisSlice'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

interface Parameter {
  name: string
  location: string
  schemaType?: string
  schemaFormat?: string
  required?: boolean
  deprecated?: boolean
  description?: string
}

interface ParametersTabProps {
  parameters: Parameter[]
}

const LOCATION_CLASSES: Record<string, string> = {
  path:   'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  query:  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  header: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  cookie: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

function LocationBadge({ location }: { location: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      LOCATION_CLASSES[location] ?? 'bg-gray-100 text-gray-700',
    )}>
      {location}
    </span>
  )
}

export function ParametersTab({ parameters }: ParametersTabProps) {
  const dispatch = useAppDispatch()
  const query = useAppSelector(selectParamsQuery)
  const debouncedQuery = useDebounce(query, 300)

  const filtered = debouncedQuery
    ? parameters.filter(
        (p) =>
          p.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(debouncedQuery.toLowerCase()),
      )
    : parameters

  if (parameters.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Parameters will appear here after the spec is indexed.
      </div>
    )
  }

  return (
    <>
      <div className="mb-4">
        <Input
          placeholder="Search parameters..."
          value={query}
          onChange={(e) => dispatch(setParamsQuery(e.target.value))}
          className="max-w-sm"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-24">Location</TableHead>
            <TableHead className="w-32">Type</TableHead>
            <TableHead className="w-16">Req.</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((param, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{param.name}</TableCell>
              <TableCell><LocationBadge location={param.location} /></TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {[param.schemaType, param.schemaFormat].filter(Boolean).join(' ') || '—'}
              </TableCell>
              <TableCell>{param.required ? '✓' : ''}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                {param.deprecated && <span className="text-amber-600 mr-1">⚠</span>}
                {param.description}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
