import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const createChartPanel = (title: string) => () => (
  <div>
    <h4 className="text-sm font-medium mb-2">{title}</h4>
    <div className="h-48 flex items-center justify-center border border-border rounded-lg bg-muted/20">
      <p className="text-muted-foreground">Chart coming soon</p>
    </div>
  </div>
)

const RequestVolumeChart = createChartPanel('Request Volume')
const ResponseTimeTrendsChart = createChartPanel('Response Time Trends')

const MetricsTab = () => (
  <Card>
    <CardHeader>
      <CardTitle>Performance Metrics</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <RequestVolumeChart />
        <ResponseTimeTrendsChart />
      </div>
    </CardContent>
  </Card>
)

export default MetricsTab
