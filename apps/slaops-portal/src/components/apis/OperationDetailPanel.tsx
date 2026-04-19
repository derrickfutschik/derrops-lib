import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { MethodBadge } from './MethodBadge'

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

interface OperationDetailPanelProps {
  operation: Operation | null
  onClose: () => void
}

export function OperationDetailPanel({ operation, onClose }: OperationDetailPanelProps) {
  return (
    <Sheet open={!!operation} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        {operation && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <MethodBadge method={operation.method} />
                <span className="font-mono text-sm font-normal">{operation.path}</span>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {operation.deprecated && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">⚠ deprecated</Badge>
              )}
              {operation.operationId && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Operation ID</p>
                  <p className="text-sm font-mono">{operation.operationId}</p>
                </div>
              )}
              {operation.pathKey && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Path key</p>
                  <p className="text-sm font-mono">{operation.pathKey}</p>
                </div>
              )}
              {operation.summary && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Summary</p>
                  <p className="text-sm">{operation.summary}</p>
                </div>
              )}
              {operation.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm text-muted-foreground">{operation.description}</p>
                </div>
              )}
              {operation.tagsText && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {operation.tagsText.split(' ').filter(Boolean).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
