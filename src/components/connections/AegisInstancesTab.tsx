import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AegisInstance, RelayInstance } from '@/client/slaops-cloud'
import { useDeleteAegis, useHealthCheckAegis } from '@/hooks/useConnectionsApi'
import { formatDistanceToNow } from 'date-fns'
import { Activity, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { EditAegisDrawer } from './EditAegisDrawer'
import { RegisterAegisDialog } from './RegisterAegisDialog'
import { StatusBadge } from './StatusBadge'

interface AegisInstancesTabProps {
  aegisInstances: AegisInstance[]
  relayInstances: RelayInstance[]
  isLoading: boolean
}

export function AegisInstancesTab({ aegisInstances, relayInstances, isLoading }: AegisInstancesTabProps) {
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editAegis, setEditAegis] = useState<AegisInstance | null>(null)
  const [deleteAegis, setDeleteAegis] = useState<AegisInstance | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const deleteAegisMut = useDeleteAegis()
  const healthCheck = useHealthCheckAegis()

  const handleTest = async (aegis: AegisInstance) => {
    setTestingId(aegis.id)
    try {
      const res = await healthCheck.mutateAsync(aegis.id)
      const status = typeof res.status === 'object' ? JSON.stringify(res.status) : String(res.status)
      setTestResults((prev) => ({
        ...prev,
        [aegis.id]: { ok: status === 'active', msg: status === 'active' ? 'JWKS valid' : status },
      }))
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [aegis.id]: { ok: false, msg: err?.message || 'Could not fetch JWKS' },
      }))
    }
    setTestingId(null)
  }

  const getLinkedRelayCount = (aegisId: string) =>
    relayInstances.filter((r) => r.aegis_id === aegisId).length

  const getLinkedRelays = (aegisId: string) =>
    relayInstances.filter((r) => r.aegis_id === aegisId)

  const getStatus = (aegis: AegisInstance): string =>
    typeof aegis.status === 'object' ? JSON.stringify(aegis.status) : String(aegis.status)

  const deleteLinkedCount = deleteAegis ? getLinkedRelayCount(deleteAegis.id) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Aegis Instances</h2>
        <Button onClick={() => setRegisterOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Register Aegis
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : aegisInstances.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">No Aegis instances registered.</p>
          <p className="text-sm text-muted-foreground">
            Register an Aegis token broker to enable secure credential delegation.
          </p>
          <Button onClick={() => setRegisterOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Register Aegis
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">URL</TableHead>
                <TableHead className="text-muted-foreground">JWKS URL</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Last seen</TableHead>
                <TableHead className="text-muted-foreground">Linked relays</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aegisInstances.map((aegis) => {
                const status = getStatus(aegis)
                const testResult = testResults[aegis.id]
                const linked = getLinkedRelays(aegis.id)

                return (
                  <TableRow
                    key={aegis.id}
                    className="border-border cursor-pointer hover:bg-secondary/30"
                    onClick={() => setEditAegis(aegis)}
                  >
                    <TableCell className="text-foreground font-medium">{aegis.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono max-w-[160px] truncate">
                      {aegis.url}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono max-w-[160px] truncate">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{aegis.jwks_url}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md break-all">{aegis.jwks_url}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={status} />
                        {testResult && (
                          <span className={`text-xs ${testResult.ok ? 'text-success' : 'text-destructive'}`}>
                            {testResult.ok ? '✓' : '✗'} {testResult.msg}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {aegis.last_seen_at
                        ? formatDistanceToNow(new Date(aegis.last_seen_at), { addSuffix: true })
                        : '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {linked.length > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs text-primary">
                              {linked.length} relay{linked.length > 1 ? 's' : ''}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 bg-card border-border p-2">
                            <ul className="text-xs text-foreground space-y-1">
                              {linked.map((r) => (
                                <li key={r.id}>• {r.name}</li>
                              ))}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={testingId === aegis.id}
                              onClick={() => handleTest(aegis)}
                            >
                              {testingId === aegis.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Activity className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Test connection</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditAegis(aegis)}
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
                              onClick={() => setDeleteAegis(aegis)}
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

      <RegisterAegisDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <EditAegisDrawer
        aegis={editAegis}
        relayInstances={relayInstances}
        open={!!editAegis}
        onOpenChange={(open) => !open && setEditAegis(null)}
      />
      <DeleteConfirmDialog
        open={!!deleteAegis}
        onOpenChange={(open) => !open && setDeleteAegis(null)}
        title={`Delete Aegis "${deleteAegis?.name}"?`}
        description={
          deleteLinkedCount > 0
            ? `This instance is linked to ${deleteLinkedCount} relay${deleteLinkedCount > 1 ? 's' : ''}. Those relays will have their Aegis link removed. You will need to redeploy those relays without AEGIS_JWKS_URL or link them to a different Aegis instance. This cannot be undone.`
            : 'This Aegis instance will be permanently deleted. This cannot be undone.'
        }
        isDeleting={deleteAegisMut.isPending}
        onConfirm={async () => {
          if (deleteAegis) {
            await deleteAegisMut.mutateAsync(deleteAegis.id)
            setDeleteAegis(null)
          }
        }}
      />
    </div>
  )
}
