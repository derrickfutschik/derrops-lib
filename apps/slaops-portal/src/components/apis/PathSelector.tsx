import { Search, PlusCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WizardCatalogueSearch } from './WizardCatalogueSearch'
import type { CatalogueHit } from '@/types/indexer'

interface PathSelectorProps {
  onSelectCatalogueHit: (hit: CatalogueHit) => void
  onRegisterOwn: () => void
}

export function PathSelector({ onSelectCatalogueHit, onRegisterOwn }: PathSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <Search className="h-5 w-5 text-primary mb-1" />
          <CardTitle className="text-base">Search platform catalogue</CardTitle>
          <CardDescription className="text-xs">
            Use a SLAOps-managed spec. Always up to date automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WizardCatalogueSearch onSelect={onSelectCatalogueHit} />
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <PlusCircle className="h-5 w-5 text-primary mb-1" />
          <CardTitle className="text-base">Register my own API</CardTitle>
          <CardDescription className="text-xs">
            Upload your own OpenAPI spec and manage it yourself.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-end">
          <Button className="w-full" variant="outline" onClick={onRegisterOwn}>
            Register my own
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
