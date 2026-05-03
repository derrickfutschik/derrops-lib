import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { useCatalogue } from '@/hooks/useIndexerApi'
import type { CatalogueHit } from '@/types/indexer'
import { useState } from 'react'

interface WizardCatalogueSearchProps {
  onSelect: (hit: CatalogueHit) => void
}

function CatalogueHitRow({ hit, onSelect }: { hit: CatalogueHit; onSelect: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{hit.title}</p>
        {hit.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{hit.description}</p>
        )}
        <div className="flex gap-2 mt-1.5">
          {hit.operationCount != null && (
            <Badge variant="secondary" className="text-xs">
              {hit.operationCount} ops
            </Badge>
          )}
          {hit.serverCount != null && (
            <Badge variant="secondary" className="text-xs">
              {hit.serverCount} servers
            </Badge>
          )}
          {hit.version && (
            <Badge variant="outline" className="text-xs font-mono">
              {hit.version}
            </Badge>
          )}
        </div>
      </div>
      <Button size="sm" onClick={onSelect}>
        Use this API
      </Button>
    </div>
  )
}

export function WizardCatalogueSearch({ onSelect }: WizardCatalogueSearchProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const { data, isLoading } = useCatalogue(debouncedQuery)

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search platform catalogue..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {isLoading && (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        )}
        {!isLoading && data?.hits.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No results — try a different search term.
          </p>
        )}
        {data?.hits.map((hit) => (
          <CatalogueHitRow key={hit.id} hit={hit} onSelect={() => onSelect(hit)} />
        ))}
      </div>
    </div>
  )
}
