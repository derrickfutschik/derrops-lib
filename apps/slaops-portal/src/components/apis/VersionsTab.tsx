import { Button } from '@/components/ui/button'

export function VersionsTab() {
  return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      <p>Version history coming soon — run a new indexing pass to update.</p>
      <Button variant="outline" size="sm" className="mt-3" disabled>
        Diff
      </Button>
    </div>
  )
}
