import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AegisInstance } from '@/client/slaops-cloud'
import { Info } from 'lucide-react'

export type AegisMode = 'skip' | 'existing' | 'new'

export interface NewAegisForm {
  name: string
  url: string
  jwksUrl: string
}

interface WizardAegisProps {
  mode: AegisMode
  onModeChange: (m: AegisMode) => void
  existingInstances: AegisInstance[]
  selectedAegisId: string | null
  onSelectedAegisIdChange: (id: string | null) => void
  newForm: NewAegisForm
  onNewFormChange: (f: NewAegisForm) => void
}

export function WizardAegis({
  mode,
  onModeChange,
  existingInstances,
  selectedAegisId,
  onSelectedAegisIdChange,
  newForm,
  onNewFormChange,
}: WizardAegisProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-md bg-muted/50 border p-3">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Aegis is an optional token broker that ensures only sessions authorised by your identity
          provider can use this relay.
        </p>
      </div>

      <div className="space-y-2">
        {(['skip', 'existing', 'new'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`w-full text-left rounded-lg border p-3 transition-colors ${
              mode === m ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <div className="font-medium text-sm">
              {m === 'skip' ? 'Skip — no Aegis for this connection' :
               m === 'existing' ? 'Link an existing Aegis instance' :
               'Register a new Aegis instance'}
            </div>
          </button>
        ))}
      </div>

      {mode === 'existing' && (
        <div className="space-y-2">
          <Label>Select Aegis instance</Label>
          {existingInstances.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Aegis instances registered yet.</p>
          ) : (
            <Select
              value={selectedAegisId ?? ''}
              onValueChange={v => onSelectedAegisIdChange(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an Aegis instance" />
              </SelectTrigger>
              <SelectContent>
                {existingInstances.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.status && (
                      <span className="ml-2 text-xs text-muted-foreground">({String(a.status)})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedAegisId && (
            <p className="text-xs text-muted-foreground">
              After saving, set <code>AEGIS_JWKS_URL</code> on your relay and redeploy.
            </p>
          )}
        </div>
      )}

      {mode === 'new' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="aegis-name">Name</Label>
            <Input
              id="aegis-name"
              placeholder="Production Aegis"
              value={newForm.name}
              onChange={e => onNewFormChange({ ...newForm, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aegis-url">URL</Label>
            <Input
              id="aegis-url"
              placeholder="https://aegis.example.com"
              value={newForm.url}
              onChange={e => {
                const url = e.target.value
                const jwksUrl = url && !newForm.jwksUrl ? `${url}/.well-known/jwks.json` : newForm.jwksUrl
                onNewFormChange({ ...newForm, url, jwksUrl })
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aegis-jwks">JWKS URL</Label>
            <Input
              id="aegis-jwks"
              placeholder="https://aegis.example.com/.well-known/jwks.json"
              value={newForm.jwksUrl}
              onChange={e => onNewFormChange({ ...newForm, jwksUrl: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A one-time registration token will be shown in the success panel after the connection is created.
          </p>
        </div>
      )}
    </div>
  )
}
