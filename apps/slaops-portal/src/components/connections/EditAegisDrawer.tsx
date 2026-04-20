import type { AegisInstance, RelayInstance } from '@/client/slaops-cloud'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useHealthCheckAegis, useUpdateAegis } from '@/hooks/useConnectionsApi'
import { Activity, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CopyButton } from './CopyButton'
import { StatusBadge } from './StatusBadge'

interface EditAegisDrawerProps {
  aegis: AegisInstance | null
  relayInstances: RelayInstance[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditAegisDrawer({
  aegis,
  relayInstances,
  open,
  onOpenChange,
}: EditAegisDrawerProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [jwksUrl, setJwksUrl] = useState('')
  const updateAegis = useUpdateAegis()
  const healthCheck = useHealthCheckAegis()
  const [healthResult, setHealthResult] = useState<{ ok: boolean; message: string } | null>(null)

  const linkedRelays = aegis ? relayInstances.filter((r) => r.aegis_id === aegis.id) : []

  const isPending = aegis?.registration_token_hash !== null

  useEffect(() => {
    if (aegis) {
      setName(aegis.name)
      setUrl(aegis.url)
      setJwksUrl(aegis.jwks_url)
      setHealthResult(null)
    }
  }, [aegis])

  const handleSave = async () => {
    if (!aegis) return
    await updateAegis.mutateAsync({
      id: aegis.id,
      dto: { name, url, jwksUrl },
    })
    onOpenChange(false)
  }

  const handleTest = async () => {
    if (!aegis) return
    setHealthResult(null)
    try {
      const res = await healthCheck.mutateAsync(aegis.id)
      const status =
        typeof res.status === 'object' ? JSON.stringify(res.status) : String(res.status)
      setHealthResult({
        ok: status === 'active',
        message: status === 'active' ? 'JWKS valid' : `Status: ${status}`,
      })
    } catch (err: any) {
      setHealthResult({ ok: false, message: err?.message || 'Could not fetch JWKS' })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">Edit Aegis</SheetTitle>
        </SheetHeader>

        {aegis && (
          <div className="space-y-5 mt-6">
            <div className="space-y-2">
              <Label className="text-foreground">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-secondary/30 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-secondary/30 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">JWKS URL</Label>
              <Input
                value={jwksUrl}
                onChange={(e) => setJwksUrl(e.target.value)}
                className="bg-secondary/30 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Instance ID (read-only)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-secondary/50 rounded px-3 py-2 text-xs text-foreground font-mono break-all">
                  {aegis.id}
                </code>
                <CopyButton text={aegis.id} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-muted-foreground text-xs">Status</Label>
              <StatusBadge
                status={
                  typeof aegis.status === 'object'
                    ? JSON.stringify(aegis.status)
                    : String(aegis.status)
                }
              />
            </div>

            {isPending && (
              <p className="text-xs text-warning">
                Registration handshake not completed. Delete and re-register to get a new token.
              </p>
            )}

            {linkedRelays.length > 0 && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Linked relays</Label>
                <ul className="text-xs text-foreground space-y-0.5">
                  {linkedRelays.map((r) => (
                    <li key={r.id}>• {r.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Test Connection */}
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

            <Button onClick={handleSave} disabled={updateAegis.isPending} className="w-full">
              {updateAegis.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
