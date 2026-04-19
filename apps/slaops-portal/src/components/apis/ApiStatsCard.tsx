import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OaSpecRef } from '@/client/slaops-cloud'
import { formatDistanceToNow } from 'date-fns'

interface ApiStatsCardProps {
  oaSpec: OaSpecRef
}

function StatRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? '—'}</span>
    </div>
  )
}

export function ApiStatsCard({ oaSpec }: ApiStatsCardProps) {
  if (!oaSpec.latestVersion) return null

  const lastIndexed = oaSpec.lastIndexedAt
    ? formatDistanceToNow(new Date(oaSpec.lastIndexedAt), { addSuffix: true })
    : '—'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Spec Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <StatRow label="Latest version" value={oaSpec.latestVersion} />
        <StatRow label="Last indexed" value={lastIndexed} />
        <StatRow label="Operations" value={oaSpec.operationCount} />
        <StatRow label="Servers" value={oaSpec.serverCount} />
        <StatRow label="Parameters" value={oaSpec.parameterCount} />
        <StatRow label="Models" value={oaSpec.modelCount} />
      </CardContent>
    </Card>
  )
}
