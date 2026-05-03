import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ServiceMetricCardProps {
  title: string
  icon: React.ReactNode
  value: string
  badge?: { label: string; variant: 'default' | 'secondary' | 'destructive' }
  subtitle?: string
}

const ServiceMetricCard = ({ title, icon, value, badge, subtitle }: ServiceMetricCardProps) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-medium flex items-center gap-2">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold">{value}</div>
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </CardContent>
  </Card>
)

export default ServiceMetricCard
