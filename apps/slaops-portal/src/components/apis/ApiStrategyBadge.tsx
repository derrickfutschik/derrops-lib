import { VersionFetchStateStrategyEnum } from '@/client/slaops-cloud'
import { Badge } from '@/components/ui/badge'

interface ApiStrategyBadgeProps {
  strategy?: string
}

export function ApiStrategyBadge({ strategy }: ApiStrategyBadgeProps) {
  if (strategy === VersionFetchStateStrategyEnum.UrlFetch) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">
        url_fetch
      </Badge>
    )
  }
  return <Badge variant="secondary">manual</Badge>
}
