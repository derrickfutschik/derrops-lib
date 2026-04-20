import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AlertTriangle } from 'lucide-react'
import type { ConnectivityMode } from './WizardConnectivity'

export type RelayType = 'managed' | 'self-hosted' | 'local-dev'

const RELAY_TYPES: { id: RelayType; label: string; description: string }[] = [
  {
    id: 'self-hosted',
    label: 'Self-hosted',
    description: 'Customer-deployed relay on your own infrastructure.',
  },
  { id: 'managed', label: 'Managed', description: 'SLAOps-hosted relay managed by SLAOps.' },
  { id: 'local-dev', label: 'Local', description: "Developer's local machine via the slaops CLI." },
]

interface WizardRelayDetailsProps {
  name: string
  onNameChange: (name: string) => void
  relayType: RelayType
  onRelayTypeChange: (type: RelayType) => void
  connectivity: ConnectivityMode | null
}

export function WizardRelayDetails({
  name,
  onNameChange,
  relayType,
  onRelayTypeChange,
  connectivity,
}: WizardRelayDetailsProps) {
  const localWithHttp = relayType === 'local-dev' && connectivity === 'direct-http'

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="conn-name">Connection name</Label>
        <Input
          id="conn-name"
          placeholder="My Relay"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <Label>Relay type</Label>
        <RadioGroup
          value={relayType}
          onValueChange={(v) => onRelayTypeChange(v as RelayType)}
          className="space-y-2"
        >
          {RELAY_TYPES.map((t) => (
            <div
              key={t.id}
              className="flex items-start space-x-3 rounded-lg border border-border p-3"
            >
              <RadioGroupItem value={t.id} id={`rt-${t.id}`} className="mt-0.5" />
              <div>
                <Label htmlFor={`rt-${t.id}`} className="font-medium cursor-pointer">
                  {t.label}
                </Label>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {localWithHttp && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Local relays cannot accept inbound connections. Switch to SQS, or go back to Step 1 and
            choose a different connectivity option.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
