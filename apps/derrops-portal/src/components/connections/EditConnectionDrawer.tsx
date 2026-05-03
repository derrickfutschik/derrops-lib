import type { AegisInstance, CloudRelayConnection } from '@/client/derrops-cloud'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import { useUpdateConnection } from '@/hooks/useConnectionsApi'
import { useEffect, useState } from 'react'
import { CopyButton } from './CopyButton'

interface EditConnectionDrawerProps {
  connection: CloudRelayConnection | null
  aegisInstances: AegisInstance[]
  onClose: () => void
}

export function EditConnectionDrawer({
  connection,
  aegisInstances,
  onClose,
}: EditConnectionDrawerProps) {
  const { toast } = useToast()
  const updateMutation = useUpdateConnection()

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [aegisId, setAegisId] = useState<string | null>(null)

  useEffect(() => {
    if (connection) {
      setName(connection.name)
      setUrl(connection.url ?? '')
      setAegisId(
        (connection as CloudRelayConnection & { aegis_id?: string | null }).aegis_id ?? null,
      )
    }
  }, [connection])

  const isLocal = connection?.type === 'local-dev'
  const hasSqs =
    connection?.delivery_mode === 'platform-queue' || connection?.delivery_mode === 'hybrid'
  const selectedAegis = aegisInstances.find((a) => a.id === aegisId)

  const handleSave = async () => {
    if (!connection) return
    try {
      await updateMutation.mutateAsync({
        id: connection.id,
        dto: {
          name,
          url: isLocal ? undefined : url,
          aegis_id: aegisId,
        },
      })
      toast({ title: 'Saved', description: 'Connection updated.' })
      onClose()
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update connection',
        variant: 'destructive',
      })
    }
  }

  return (
    <Sheet
      open={!!connection}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Connection</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* URL (hidden for local relay) */}
          {!isLocal && (
            <div className="space-y-2">
              <Label htmlFor="edit-url">Relay URL</Label>
              <Input id="edit-url" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          )}

          {/* Linked Aegis */}
          <div className="space-y-2">
            <Label>Linked Aegis</Label>
            <Select
              value={aegisId ?? 'none'}
              onValueChange={(v) => setAegisId(v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {aegisInstances.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {aegisId && selectedAegis && (
              <p className="text-xs text-muted-foreground">
                After linking, set{' '}
                <code className="text-xs">AEGIS_JWKS_URL={selectedAegis.jwks_url}</code> on your
                relay and redeploy.
              </p>
            )}
          </div>

          {/* Read-only fields */}
          <div className="space-y-3 pt-4 border-t">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Connection ID
              </p>
              <div className="flex items-center gap-2 rounded bg-muted/50 border px-3 py-2">
                <code className="text-xs font-mono flex-1 truncate">{connection?.id}</code>
                {connection && <CopyButton text={connection.id} />}
              </div>
            </div>

            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium capitalize">{connection?.type?.replace('-', ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Delivery mode</p>
                <p className="font-medium">{connection?.delivery_mode}</p>
              </div>
            </div>

            {hasSqs && connection?.sqs_queue_url && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  SQS Queue
                </p>
                <div className="flex items-center gap-2 rounded bg-muted/50 border px-3 py-2">
                  <code className="text-xs font-mono flex-1 truncate">
                    {connection.sqs_queue_url}
                  </code>
                  <CopyButton text={connection.sqs_queue_url} />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
