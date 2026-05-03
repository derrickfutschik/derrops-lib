import { Activity, AlertTriangle, DollarSign, TrendingUp } from 'lucide-react'
import StatCard from './StatCard'

const StatsOverview = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    <StatCard
      title="Total Services"
      icon={<Activity className="h-4 w-4 text-primary" />}
      value="12"
      trend="+2"
      trendColor="text-success"
      trendLabel="from last month"
    />
    <StatCard
      title="API Calls"
      icon={<TrendingUp className="h-4 w-4 text-primary" />}
      value="2.4M"
      trend="+15%"
      trendColor="text-success"
      trendLabel="from last week"
    />
    <StatCard
      title="Active Alerts"
      icon={<AlertTriangle className="h-4 w-4 text-warning" />}
      value="3"
      trend="2"
      trendColor="text-warning"
      trendLabel="require attention"
    />
    <StatCard
      title="Monthly Cost"
      icon={<DollarSign className="h-4 w-4 text-primary" />}
      value="$12,450"
      trend="+8%"
      trendColor="text-destructive"
      trendLabel="from last month"
    />
  </div>
)

export default StatsOverview
