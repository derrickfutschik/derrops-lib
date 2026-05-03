import type { RelayInstance } from '@/client/derrops-cloud'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { API_BASE_URL } from '@/config'
import { useCreateRelay } from '@/hooks/useConnectionsApi'
import { useState } from 'react'
import { CopyButton } from './CopyButton'

interface RegisterRelayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RegisterRelayDialog({ open, onOpenChange }: RegisterRelayDialogProps) {
  const [tab, setTab] = useState<string>('standard')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<RelayInstance | null>(null)
  const createRelay = useCreateRelay()

  const handleSubmitStandard = async () => {
    const res = await createRelay.mutateAsync({ name, url })
    setResult(res)
  }

  const handleSubmitLocal = async () => {
    const res = await createRelay.mutateAsync({ name: name || 'My local relay', url: '' })
    setResult(res)
  }

  const handleClose = () => {
    setName('')
    setUrl('')
    setResult(null)
    setTab('standard')
    onOpenChange(false)
  }

  const jwksUrl = `${API_BASE_URL}/cloud-relay/.well-known/jwks.json`

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Register Relay</DialogTitle>
        </DialogHeader>

        {result ? (
          tab === 'local' ? (
            <div className="space-y-4">
              <p className="text-sm text-success font-medium">Local relay registered.</p>
              <p className="text-sm text-muted-foreground">
                Run the following commands on your machine:
              </p>
              <div className="bg-secondary/50 rounded-lg p-3 font-mono text-xs text-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <span>derrops relay init</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>derrops relay start</span>
                </div>
              </div>
              <CopyButton
                text={`derrops relay init\nderrops relay start`}
                className="w-full border border-border"
              />
              <p className="text-xs text-muted-foreground">
                Already initialized? Just run{' '}
                <code className="text-primary">derrops relay start</code>.
              </p>
              <p className="text-xs text-muted-foreground">
                The relay will appear as Active once it connects.
              </p>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-success font-medium">Relay registered.</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Your relay ID</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-secondary/50 rounded px-3 py-2 text-xs text-foreground font-mono break-all">
                      {result.id}
                    </code>
                    <CopyButton text={result.id} />
                  </div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p>
                    Set this as <code className="text-primary">RELAY_ID</code> on your relay
                    deployment.
                  </p>
                  <p>Also set:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-foreground break-all">
                      DERROPS_VENDOR_JWKS_URL = {jwksUrl}
                    </code>
                    <CopyButton text={jwksUrl} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Then click "Test Connection" to confirm the relay is reachable.
                </p>
              </div>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          )
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full bg-secondary/50">
              <TabsTrigger value="standard" className="flex-1">
                Self-hosted / Managed
              </TabsTrigger>
              <TabsTrigger value="local" className="flex-1">
                Local (dev)
              </TabsTrigger>
            </TabsList>
            <TabsContent value="standard" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-foreground">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Production Relay"
                  className="bg-secondary/30 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">URL</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://relay.example.com"
                  type="url"
                  className="bg-secondary/30 border-border"
                />
              </div>
              <Button
                onClick={handleSubmitStandard}
                disabled={!name || !url || createRelay.isPending}
                className="w-full"
              >
                {createRelay.isPending ? 'Registering…' : 'Register Relay'}
              </Button>
            </TabsContent>
            <TabsContent value="local" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-foreground">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My local relay"
                  className="bg-secondary/30 border-border"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Local relays use platform-queue delivery mode and have no inbound URL.
              </p>
              <Button
                onClick={handleSubmitLocal}
                disabled={createRelay.isPending}
                className="w-full"
              >
                {createRelay.isPending ? 'Registering…' : 'Register Local Relay'}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
