import type { AegisCreateResponseDto } from '@/client/derrops-cloud'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_BASE_URL } from '@/config'
import { useCreateAegis } from '@/hooks/useConnectionsApi'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { CopyButton } from './CopyButton'

interface RegisterAegisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RegisterAegisDialog({ open, onOpenChange }: RegisterAegisDialogProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [jwksUrl, setJwksUrl] = useState('')
  const [result, setResult] = useState<AegisCreateResponseDto | null>(null)
  const createAegis = useCreateAegis()

  const handleUrlChange = (val: string) => {
    setUrl(val)
    if (!jwksUrl || jwksUrl === `${url}/.well-known/jwks.json`) {
      setJwksUrl(`${val}/.well-known/jwks.json`)
    }
  }

  const handleSubmit = async () => {
    const res = await createAegis.mutateAsync({ name, url, jwksUrl })
    setResult(res)
  }

  const handleClose = () => {
    setName('')
    setUrl('')
    setJwksUrl('')
    setResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Register Aegis</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <p className="text-sm text-success font-medium">Aegis registered.</p>

            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning">
                Save this token now. It cannot be retrieved after you close this dialog.
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">One-time registration token</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-secondary/50 rounded px-3 py-2 text-xs text-foreground font-mono break-all select-all">
                  {result.registrationToken}
                </code>
                <CopyButton text={result.registrationToken} />
              </div>
            </div>

            <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p>
                Set this as <code className="text-primary">DERROPS_REGISTRATION_TOKEN</code> on your
                Aegis deployment.
              </p>
              <p>Also set:</p>
              <div className="flex items-center gap-2">
                <code className="text-foreground break-all">
                  DERROPS_PLATFORM_URL = {API_BASE_URL}
                </code>
                <CopyButton text={API_BASE_URL} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Once Aegis calls back, status will change to Active.
            </p>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production Aegis"
                className="bg-secondary/30 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">URL</Label>
              <Input
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://aegis.example.com"
                type="url"
                className="bg-secondary/30 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">JWKS URL</Label>
              <Input
                value={jwksUrl}
                onChange={(e) => setJwksUrl(e.target.value)}
                placeholder="https://aegis.example.com/.well-known/jwks.json"
                type="url"
                className="bg-secondary/30 border-border"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!name || !url || !jwksUrl || createAegis.isPending}
              className="w-full"
            >
              {createAegis.isPending ? 'Registering…' : 'Register Aegis'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
