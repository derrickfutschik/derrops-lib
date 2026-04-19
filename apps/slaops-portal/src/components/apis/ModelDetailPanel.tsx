import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'

interface Model {
  name: string
  schemaType?: string
  usedInText?: string
  description?: string
  propertiesText?: string
}

interface ModelDetailPanelProps {
  model: Model | null
  onClose: () => void
}

export function ModelDetailPanel({ model, onClose }: ModelDetailPanelProps) {
  return (
    <Sheet open={!!model} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        {model && (
          <>
            <SheetHeader>
              <SheetTitle>{model.name}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {model.schemaType && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Type</p>
                  <Badge variant="secondary" className="font-mono">{model.schemaType}</Badge>
                </div>
              )}
              {model.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{model.description}</p>
                </div>
              )}
              {model.propertiesText && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Properties</p>
                  <pre className="text-xs font-mono bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap">
                    {model.propertiesText}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
