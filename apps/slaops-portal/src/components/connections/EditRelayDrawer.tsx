import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { AegisInstance, RelayInstance } from '@/client/slaops-cloud'
import { useHealthCheckRelay, useUpdateRelay } from '@/hooks/useConnectionsApi'
import { Activity, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CopyButton } from './CopyButton'
import { StatusBadge } from './StatusBadge'

interface EditRelayDrawerProps {
  relay: RelayInstance | null
  aegisInstances: AegisInstance[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditRelayDrawer({ relay, aegisInstances, open, onOpenChange }: EditRelayDrawerProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [aegisId, setAegisId] = useState<string>('none')
  const updateRelay = useUpdateRelay()
  const healthCheck = useHealthCheckRelay()
  const [healthResult, setHealthResult] = useState<{ ok: boolean; message: string } | null>(null)

  const isLocalDev = !relay?.url

  useEffect(() => {
    if (relay) {
      setName(relay.name)
      setUrl(relay.url)
      setAegisId(relay.aegis_id ?? 'none')
      setHealthResult(null)
    }
  }, [relay])

  const handleSave = async () => {
    if (!relay) return
    await updateRelay.mutateAsync({
      id: relay.id,
      dto: {
        name,
        ...(isLocalDev ? {} : { url }),
        aegisId: aegisId === 'none' ? undefined : aegisId,
      },
    })
    onOpenChange(false)
  }

  const handleTest = async () => {
    if (!relay) return
    setHealthResult(null)
    try {
      const res = await healthCheck.mutateAsync(relay.id)
      const status = typeof res.status === 'object' ? JSON.stringify(res.status) : String(res.status)
      setHealthResult({
        ok: status === 'active',
        message: status === 'active' ? 'Reachable' : `Status: ${status}`,
      })
    } catch (err: any) {
      setHealthResult({ ok: false, message: err?.message || 'Unreachable' })
    }
  }

  const linkedAegis = aegisInstances.find((a) => a.id === aegisId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">Edit Relay</SheetTitle>
        </SheetHeader>

        {relay && (
          <div className="space-y-5 mt-6">
            <div className="space-y-2">
              <Label className="text-foreground">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/30 border-border" />
            </div>

            {!isLocalDev && (
              <div className="space-y-2">
                <Label className="text-foreground">URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} className="bg-secondary/30 border-border" />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-foreground">Linked Aegis</Label>
              <Select value={aegisId} onValueChange={setAegisId}>
                <SelectTrigger className="bg-secondary/30 border-border">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none">None</SelectItem>
                  {aegisInstances.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {linkedAegis && aegisId !== 'none' && (
                <p className="text-xs text-warning">
                  After linking, set <code className="text-primary">AEGIS_JWKS_URL = {linkedAegis.jwks_url}</code> on the relay and redeploy.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Relay ID (read-only)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-secondary/50 rounded px-3 py-2 text-xs text-foreground font-mono break-all">
                  {relay.id}
                </code>
                <CopyButton text={relay.id} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-muted-foreground text-xs">Status</Label>
              <StatusBadge status={typeof relay.status === 'object' ? JSON.stringify(relay.status) : String(relay.status)} />
            </div>

            {isLocalDev && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Delivery mode</Label>
                <p className="text-xs text-foreground">Platform Queue</p>
              </div>
            )}

            {/* Test Connection */}
            {!isLocalDev ? (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={healthCheck.isPending}
                  className="w-full"
                >
                  {healthCheck.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
                {healthResult && (
                  <p className={`text-xs ${healthResult.ok ? 'text-success' : 'text-destructive'}`}>
                    {healthResult.ok ? '✓' : '✗'} {healthResult.message}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Local relays are not directly reachable. Status reflects the last time the relay polled for a job.
              </p>
            )}

            <Button
              onClick={handleSave}
              disabled={updateRelay.isPending}
              className="w-full"
            >
              {updateRelay.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
