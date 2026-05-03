import type { AegisInstance, RelayInstance } from '@/client/derrops-cloud'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDeleteRelay, useHealthCheckRelay } from '@/hooks/useConnectionsApi'
import { formatDistanceToNow } from 'date-fns'
import { Activity, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { EditRelayDrawer } from './EditRelayDrawer'
import { RegisterRelayDialog } from './RegisterRelayDialog'
import { StatusBadge } from './StatusBadge'

interface RelayInstancesTabProps {
  relays: RelayInstance[]
  aegisInstances: AegisInstance[]
  isLoading: boolean
}

export function RelayInstancesTab({ relays, aegisInstances, isLoading }: RelayInstancesTabProps) {
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editRelay, setEditRelay] = useState<RelayInstance | null>(null)
  const [deleteRelay, setDeleteRelay] = useState<RelayInstance | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const deleteRelayMut = useDeleteRelay()
  const healthCheck = useHealthCheckRelay()

  const handleTest = async (relay: RelayInstance) => {
    setTestingId(relay.id)
    try {
      const res = await healthCheck.mutateAsync(relay.id)
      const status =
        typeof res.status === 'object' ? JSON.stringify(res.status) : String(res.status)
      setTestResults((prev) => ({
        ...prev,
        [relay.id]: { ok: status === 'active', msg: status === 'active' ? 'Reachable' : status },
      }))
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [relay.id]: { ok: false, msg: err?.message || 'Unreachable' },
      }))
    }
    setTestingId(null)
  }

  const getAegisName = (aegisId: string | null) => {
    if (!aegisId) return 'None'
    return aegisInstances.find((a) => a.id === aegisId)?.name ?? 'Unknown'
  }

  const getStatus = (relay: RelayInstance): string => {
    return typeof relay.status === 'object' ? JSON.stringify(relay.status) : String(relay.status)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Relay Instances</h2>
        <Button onClick={() => setRegisterOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Register Relay
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : relays.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">No relay instances registered.</p>
          <p className="text-sm text-muted-foreground">
            Register a relay to start routing Derrops Client requests through your infrastructure.
          </p>
          <Button onClick={() => setRegisterOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Register Relay
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">URL</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Last seen</TableHead>
                <TableHead className="text-muted-foreground">Aegis</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relays.map((relay) => {
                const status = getStatus(relay)
                const testResult = testResults[relay.id]
                const isLocal = !relay.url

                return (
                  <TableRow
                    key={relay.id}
                    className="border-border cursor-pointer hover:bg-secondary/30"
                    onClick={() => setEditRelay(relay)}
                  >
                    <TableCell className="text-foreground font-medium">{relay.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono max-w-[200px] truncate">
                      {relay.url || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={status} />
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
                      {relay.last_seen_at
                        ? formatDistanceToNow(new Date(relay.last_seen_at), { addSuffix: true })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {getAegisName(relay.aegis_id)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {!isLocal && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={testingId === relay.id}
                                onClick={() => handleTest(relay)}
                              >
                                {testingId === relay.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Activity className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Test connection</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditRelay(relay)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteRelay(relay)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <RegisterRelayDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <EditRelayDrawer
        relay={editRelay}
        aegisInstances={aegisInstances}
        open={!!editRelay}
        onOpenChange={(open) => !open && setEditRelay(null)}
      />
      <DeleteConfirmDialog
        open={!!deleteRelay}
        onOpenChange={(open) => !open && setDeleteRelay(null)}
        title={`Delete relay "${deleteRelay?.name}"?`}
        description="The relay UUID will be invalidated. The platform will no longer accept or route jobs to it. This cannot be undone."
        isDeleting={deleteRelayMut.isPending}
        onConfirm={async () => {
          if (deleteRelay) {
            await deleteRelayMut.mutateAsync(deleteRelay.id)
            setDeleteRelay(null)
          }
        }}
      />
    </div>
  )
}
