import type { VersionFetchState } from '@/client/slaops-cloud'
import { VersionFetchStateLastStatusEnum } from '@/client/slaops-cloud'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'

interface ApiFetchStatusCardProps {
  fetch: VersionFetchState
}

function StatusBadge({ status }: { status?: string }) {
  if (status === VersionFetchStateLastStatusEnum.Ok) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">
        ok
      </Badge>
    )
  }
  if (status === VersionFetchStateLastStatusEnum.Error) {
    return <Badge variant="destructive">error</Badge>
  }
  if (status === VersionFetchStateLastStatusEnum.NoChange) {
    return <Badge variant="secondary">no_change</Badge>
  }
  return <Badge variant="outline">—</Badge>
}

function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] break-all">{children}</span>
    </div>
  )
}

export function ApiFetchStatusCard({ fetch: fetchState }: ApiFetchStatusCardProps) {
  const lastFetched = fetchState.lastAt
    ? formatDistanceToNow(new Date(fetchState.lastAt), { addSuffix: true })
    : 'Never'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Fetch Status</CardTitle>
      </CardHeader>
      <CardContent>
        <StatRow label="Fetch URL">{fetchState.url ?? '—'}</StatRow>
        <StatRow label="Schedule">{fetchState.cron ?? '—'}</StatRow>
        <StatRow label="Last fetched">{lastFetched}</StatRow>
        <StatRow label="Last status">
          <StatusBadge status={fetchState.lastStatus} />
        </StatRow>
        {fetchState.lastStatus === VersionFetchStateLastStatusEnum.Error &&
          fetchState.lastError && (
            <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive break-all">
              {fetchState.lastError}
            </div>
          )}
      </CardContent>
    </Card>
  )
}
