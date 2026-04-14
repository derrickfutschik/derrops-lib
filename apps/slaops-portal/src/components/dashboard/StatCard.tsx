import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StatCardProps {
  title: string
  icon: React.ReactNode
  value: string
  trend: string
  trendColor: string
  trendLabel: string
}

const StatCard = ({ title, icon, value, trend, trendColor, trendLabel }: StatCardProps) => (
  <Card className="border-border bg-card/50 backdrop-blur">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <p className="text-xs text-muted-foreground">
        <span className={trendColor}>{trend}</span> {trendLabel}
      </p>
    </CardContent>
  </Card>
)

export default StatCard
