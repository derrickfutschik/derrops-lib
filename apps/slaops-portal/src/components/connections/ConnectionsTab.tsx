import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AegisInstance, CloudRelayConnection } from '@/client/slaops-cloud'
import {
  useDeleteConnection,
  useHealthCheckConnection,
  useTestQueueConnection,
} from '@/hooks/useConnectionsApi'
import { useToast } from '@/components/ui/use-toast'
import { Activity, Pencil, Plus, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { EditConnectionDrawer } from './EditConnectionDrawer'
import { CreateConnectionWizard } from './CreateConnectionWizard'
import { StatusBadge } from './StatusBadge'

type ConnectivityLabel = 'Direct HTTP' | 'SQS' | 'SQS + HTTP' | string

function connectivityLabel(mode: string): ConnectivityLabel {
  if (mode === 'direct' || mode === 'relay-queue') return 'Direct HTTP'
  if (mode === 'platform-queue') return 'SQS'
  if (mode === 'hybrid') return 'SQS + HTTP'
  return mode
}

function relayTypeLabel(type: string) {
  if (type === 'local-dev') return 'Local'
  if (type === 'self-hosted') return 'Self-hosted'
  return 'Managed'
}

interface TestState {
  id: string
  status: 'loading' | 'ok' | 'err'
  msg: string
}

interface ConnectionsTabProps {
  connections: CloudRelayConnection[]
  aegisInstances: AegisInstance[]
  isLoading: boolean
}

export function ConnectionsTab({ connections, aegisInstances, isLoading }: ConnectionsTabProps) {
  const { toast } = useToast()
  const deleteMutation = useDeleteConnection()
  const healthCheck = useHealthCheckConnection()
  const testQueue = useTestQueueConnection()

  const [wizardOpen, setWizardOpen] = useState(false)
  const [editConn, setEditConn] = useState<CloudRelayConnection | null>(null)
  const [deleteConn, setDeleteConn] = useState<CloudRelayConnection | null>(null)
  const [testStates, setTestStates] = useState<Record<string, TestState>>({})

  const aegisMap = Object.fromEntries(aegisInstances.map(a => [a.id, a]))

  const handleTest = async (conn: CloudRelayConnection) => {
    setTestStates(s => ({ ...s, [conn.id]: { id: conn.id, status: 'loading', msg: '' } }))
    try {
      const isHttp = conn.delivery_mode === 'direct' || conn.delivery_mode === 'relay-queue' || conn.delivery_mode === 'hybrid'
      const isSqs = conn.delivery_mode === 'platform-queue' || conn.delivery_mode === 'hybrid'

      if (isSqs && !conn.sqs_queue_url) {
        setTestStates(s => ({ ...s, [conn.id]: { id: conn.id, status: 'err', msg: 'No SQS queue configured' } }))
        return
      }

      if (isSqs && !isHttp) {
        const r = await testQueue.mutateAsync(conn.id)
        setTestStates(s => ({
          ...s,
          [conn.id]: { id: conn.id, status: r.sent ? 'ok' : 'err', msg: r.sent ? 'Message sent' : r.error ?? 'Send failed' },
        }))
      } else {
        const r = await healthCheck.mutateAsync(conn.id)
        setTestStates(s => ({
          ...s,
          [conn.id]: { id: conn.id, status: r.reachable ? 'ok' : 'err', msg: r.reachable ? `Reachable — ${r.latencyMs} ms` : r.error ?? 'Unreachable' },
        }))
      }
    } catch (err: unknown) {
      setTestStates(s => ({
        ...s,
        [conn.id]: { id: conn.id, status: 'err', msg: err instanceof Error ? err.message : 'Test failed' },
      }))
    }
  }

  const handleDelete = async () => {
    if (!deleteConn) return
    try {
      await deleteMutation.mutateAsync(deleteConn.id)
      toast({ title: 'Deleted', description: `Connection "${deleteConn.name}" deleted.` })
      setDeleteConn(null)
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Delete failed', variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{connections.length} connection{connections.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Connection
        </Button>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No connections yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a connection to start routing API Tester requests through your infrastructure.
          </p>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Connection
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Connectivity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Aegis</TableHead>
              <TableHead>Test</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections.map(conn => {
              const ts = testStates[conn.id]
              const aegisName = (conn as CloudRelayConnection & { aegis_id?: string | null }).aegis_id
                ? aegisMap[(conn as CloudRelayConnection & { aegis_id?: string | null }).aegis_id!]?.name ?? 'Unknown'
                : 'None'
              return (
                <TableRow key={conn.id} className="cursor-pointer hover:bg-muted/30">
                  <TableCell className="font-medium" onClick={() => setEditConn(conn)}>
                    {conn.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {connectivityLabel(conn.delivery_mode)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {relayTypeLabel(conn.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{aegisName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleTest(conn)}
                        disabled={ts?.status === 'loading'}
                      >
                        {ts?.status === 'loading' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Activity className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {ts && ts.status !== 'loading' && (
                        <span className={cn('text-xs flex items-center gap-1', ts.status === 'ok' ? 'text-success' : 'text-destructive')}>
                          {ts.status === 'ok' ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          {ts.msg}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditConn(conn)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConn(conn)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <CreateConnectionWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <EditConnectionDrawer connection={editConn} aegisInstances={aegisInstances} onClose={() => setEditConn(null)} />
      <DeleteConfirmDialog
        open={!!deleteConn}
        onOpenChange={open => { if (!open) setDeleteConn(null) }}
        title={`Delete connection "${deleteConn?.name}"?`}
        description="The connection ID will be invalidated. The platform will no longer route jobs through it."
        onConfirm={handleDelete}
        isDeleting={deleteMutation.isPending}
      />
    </>
  )
}
