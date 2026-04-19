import { Badge } from '@/components/ui/badge'
import { ApiEntityManagementModeEnum } from '@/client/slaops-cloud'

interface ApiManagementModeBadgeProps {
  mode: string
}

export function ApiManagementModeBadge({ mode }: ApiManagementModeBadgeProps) {
  if (mode === ApiEntityManagementModeEnum.Platform) {
    return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-0">Platform</Badge>
  }
  return <Badge variant="secondary">Private</Badge>
}
