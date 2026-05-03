import type { ApiEntity } from '@/client/derrops-cloud'
import { ApiEntityManagementModeEnum, VersionFetchStateStrategyEnum } from '@/client/derrops-cloud'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'
import { ApiFetchStatusCard } from './ApiFetchStatusCard'
import { ApiManagementModeBadge } from './ApiManagementModeBadge'
import { ApiStatsCard } from './ApiStatsCard'
import { ApiStrategyBadge } from './ApiStrategyBadge'
import { SpecUploadCard } from './SpecUploadCard'

interface OverviewTabProps {
  api: ApiEntity
}

export function OverviewTab({ api }: OverviewTabProps) {
  const isPrivate = api.managementMode !== ApiEntityManagementModeEnum.Platform
  const isUrlFetch = api.fetch?.strategy === VersionFetchStateStrategyEnum.UrlFetch

  const rows = [
    { label: 'Name', value: api.name },
    {
      label: 'Description',
      value: api.description || <span className="text-muted-foreground italic">none</span>,
    },
    {
      label: 'External URL',
      value: api.externalUrl ? (
        <a
          href={api.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {api.externalUrl}
        </a>
      ) : (
        <span className="text-muted-foreground italic">none</span>
      ),
    },
    { label: 'Mode', value: <ApiManagementModeBadge mode={api.managementMode} /> },
    ...(isPrivate
      ? [{ label: 'Strategy', value: <ApiStrategyBadge strategy={api.fetch?.strategy} /> }]
      : []),
    {
      label: 'Created',
      value: formatDistanceToNow(new Date(api.createdAt), { addSuffix: true }),
    },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">API Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {rows.map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0"
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm text-right max-w-[60%]">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {api.oaSpec && <ApiStatsCard oaSpec={api.oaSpec} />}
        {isPrivate && (
          <SpecUploadCard
            apiId={api.id}
            title={api.oaSpec?.latestVersion ? 'Re-index spec' : 'Upload spec'}
          />
        )}
        {isUrlFetch && api.fetch && <ApiFetchStatusCard fetch={api.fetch} />}
      </div>
    </div>
  )
}
