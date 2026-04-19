import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectModelsQuery, setModelsQuery } from '@/store/apisSlice'
import { useDebounce } from '@/hooks/useDebounce'
import { ModelDetailPanel } from './ModelDetailPanel'

interface Model {
  name: string
  schemaType?: string
  usedInText?: string
  description?: string
  propertiesText?: string
}

interface ModelsTabProps {
  models: Model[]
}

const USED_IN_CLASSES: Record<string, string> = {
  request:  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  response: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

export function ModelsTab({ models }: ModelsTabProps) {
  const dispatch = useAppDispatch()
  const query = useAppSelector(selectModelsQuery)
  const debouncedQuery = useDebounce(query, 300)
  const [selected, setSelected] = useState<Model | null>(null)

  const filtered = debouncedQuery
    ? models.filter(
        (m) =>
          m.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          m.description?.toLowerCase().includes(debouncedQuery.toLowerCase()),
      )
    : models

  if (models.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Models will appear here after the spec is indexed.
      </div>
    )
  }

  return (
    <>
      <div className="mb-4">
        <Input
          placeholder="Search models..."
          value={query}
          onChange={(e) => dispatch(setModelsQuery(e.target.value))}
          className="max-w-sm"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-24">Type</TableHead>
            <TableHead>Used in</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((model, i) => (
            <TableRow
              key={i}
              className="cursor-pointer hover:bg-secondary/50"
              onClick={() => setSelected(model)}
            >
              <TableCell className="font-medium text-sm">{model.name}</TableCell>
              <TableCell>
                {model.schemaType && (
                  <Badge variant="secondary" className="text-xs font-mono">{model.schemaType}</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {model.usedInText?.split(' ').filter(Boolean).map((use) => (
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
              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                {model.description}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ModelDetailPanel model={selected} onClose={() => setSelected(null)} />
    </>
  )
}
