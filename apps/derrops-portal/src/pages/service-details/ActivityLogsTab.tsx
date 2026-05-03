import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ActivityLogsTab = () => (
  <Card>
    <CardHeader>
      <CardTitle>Activity Logs</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground text-sm">
        No activity logs yet. Logs will appear here once SDK integration is complete.
      </p>
    </CardContent>
  </Card>
)

export default ActivityLogsTab
