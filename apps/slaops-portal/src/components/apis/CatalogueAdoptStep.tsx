import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { CatalogueHit } from '@/types/indexer'

interface CatalogueAdoptStepProps {
  hit: CatalogueHit
  isPending: boolean
  onAdopt: () => void
  onBack: () => void
}

export function CatalogueAdoptStep({ hit, isPending, onAdopt, onBack }: CatalogueAdoptStepProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{hit.title}</CardTitle>
          {hit.description && <CardDescription>{hit.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {hit.operationCount != null && (
              <Badge variant="secondary">{hit.operationCount} operations</Badge>
            )}
            {hit.serverCount != null && (
              <Badge variant="secondary">{hit.serverCount} servers</Badge>
            )}
            {hit.version && (
              <Badge variant="outline" className="font-mono">{hit.version}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            This API is managed by SLAOps. You'll always have the latest version automatically.
          </p>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onAdopt} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Adopt API
        </Button>
      </div>
    </div>
  )
}
