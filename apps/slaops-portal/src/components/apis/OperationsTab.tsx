import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { MethodBadge } from './MethodBadge'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectOperationsQuery, setOperationsQuery } from '@/store/apisSlice'
import { useDebounce } from '@/hooks/useDebounce'
import { useState } from 'react'
import { OperationDetailPanel } from './OperationDetailPanel'

interface Operation {
  method: string
  path: string
  summary?: string
  operationId?: string
  tagsText?: string
  description?: string
  pathKey?: string
  deprecated?: boolean
}

interface OperationsTabProps {
  operations: Operation[]
}

export function OperationsTab({ operations }: OperationsTabProps) {
  const dispatch = useAppDispatch()
  const query = useAppSelector(selectOperationsQuery)
  const debouncedQuery = useDebounce(query, 300)
  const [selected, setSelected] = useState<Operation | null>(null)

  const filtered = debouncedQuery
    ? operations.filter(
        (op) =>
          op.path.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          op.summary?.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          op.method.toLowerCase().includes(debouncedQuery.toLowerCase()),
      )
    : operations

  if (operations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Operations will appear here after the spec is indexed.
      </div>
    )
  }

  return (
    <>
      <div className="mb-4">
        <Input
          placeholder="Search operations..."
          value={query}
          onChange={(e) => dispatch(setOperationsQuery(e.target.value))}
          className="max-w-sm"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Method</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead>Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((op, i) => (
            <TableRow
              key={i}
              className="cursor-pointer hover:bg-secondary/50"
              onClick={() => setSelected(op)}
            >
              <TableCell><MethodBadge method={op.method} /></TableCell>
              <TableCell className="font-mono text-xs">{op.path}</TableCell>
              <TableCell className="text-sm">
                {op.deprecated && <Badge variant="outline" className="text-amber-600 border-amber-300 mr-1.5 text-xs">⚠ deprecated</Badge>}
                {op.summary}
              </TableCell>
              <TableCell>
                {op.tagsText?.split(' ').filter(Boolean).map((tag) => (
                  <Badge key={tag} variant="secondary" className="mr-1 text-xs">{tag}</Badge>
                ))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <OperationDetailPanel operation={selected} onClose={() => setSelected(null)} />
    </>
  )
}
