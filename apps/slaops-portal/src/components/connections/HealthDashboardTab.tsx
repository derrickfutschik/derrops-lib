import type { AegisInstance, RelayInstance } from '@/client/slaops-cloud'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useHealthCheckAegis, useHealthCheckRelay } from '@/hooks/useConnectionsApi'
import { formatDistanceToNow } from 'date-fns'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Shield,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { StatusBadge, TypeBadge } from './StatusBadge'

interface HealthDashboardTabProps {
  relays: RelayInstance[]
  aegisInstances: AegisInstance[]
  isLoading: boolean
  onRefresh: () => void
  onRegisterRelay: () => void
}

type CombinedRow = {
  id: string
  name: string
  type: 'relay' | 'aegis' | 'local'
  status: string
  lastSeen: string | null
  isLocal: boolean
}

export function HealthDashboardTab({
  relays,
  aegisInstances,
  isLoading,
  onRefresh,
  onRegisterRelay,
}: HealthDashboardTabProps) {
  const healthCheckRelay = useHealthCheckRelay()
  const healthCheckAegis = useHealthCheckAegis()
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-refresh every 60s
  useEffect(() => {
    intervalRef.current = setInterval(onRefresh, 60_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [onRefresh])

  const getStatus = (item: RelayInstance | AegisInstance): string =>
    typeof item.status === 'object' ? JSON.stringify(item.status) : String(item.status)

  const rows: CombinedRow[] = [
    ...relays.map((r) => ({
      id: r.id,
      name: r.name,
      type: (!r.url ? 'local' : 'relay') as CombinedRow['type'],
      status: getStatus(r),
      lastSeen: r.last_seen_at,
      isLocal: !r.url,
    })),
    ...aegisInstances.map((a) => ({
      id: a.id,
      name: a.name,
      type: 'aegis' as const,
      status: getStatus(a),
      lastSeen: a.last_seen_at,
      isLocal: false,
    })),
  ]

  const activeCount = rows.filter((r) => r.status === 'active').length
  const degradedCount = rows.filter((r) => r.status === 'unreachable').length
  const pendingCount = rows.filter((r) => r.status === 'pending').length

  const handleTest = async (row: CombinedRow) => {
    setTestingId(row.id)
    try {
      if (row.type === 'aegis') {
        const res = await healthCheckAegis.mutateAsync(row.id)
        const s = getStatus(res as any)
        setTestResults((p) => ({
          ...p,
          [row.id]: { ok: s === 'active', msg: s === 'active' ? 'OK' : s },
        }))
      } else {
        const res = await healthCheckRelay.mutateAsync(row.id)
        const s = getStatus(res as any)
        setTestResults((p) => ({
          ...p,
          [row.id]: { ok: s === 'active', msg: s === 'active' ? 'OK' : s },
        }))
      }
    } catch (err: any) {
      setTestResults((p) => ({ ...p, [row.id]: { ok: false, msg: err?.message || 'Error' } }))
    }
    setTestingId(null)
  }

  if (rows.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-lg font-medium text-foreground">No connections registered.</p>
        <p className="text-sm text-muted-foreground">
          Register a relay to start routing API Tester requests through your infrastructure.
        </p>
        <Button onClick={onRegisterRelay} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Register Relay
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Health Dashboard</h2>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Degraded</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{degradedCount}</div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending setup
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Combined status table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Component</TableHead>
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Last seen</TableHead>
              <TableHead className="text-muted-foreground text-right">Test</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const testResult = testResults[row.id]
              return (
                <TableRow key={row.id} className="border-border">
                  <TableCell className="text-foreground">
                    <div className="flex items-center gap-2">
                      {row.type === 'aegis' ? (
                        <Shield className="h-4 w-4 text-chart-4" />
                      ) : (
                        <Radio className="h-4 w-4 text-primary" />
                      )}
                      {row.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={row.type} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={row.status} />
                      {testResult && (
                        <span
                          className={`text-xs ${testResult.ok ? 'text-success' : 'text-destructive'}`}
                        >
                          {testResult.ok ? '✓' : '✗'} {testResult.msg}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {row.lastSeen
                      ? formatDistanceToNow(new Date(row.lastSeen), { addSuffix: true })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {!row.isLocal && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={testingId === row.id}
                            onClick={() => handleTest(row)}
                          >
                            {testingId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Activity className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Test connection</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
