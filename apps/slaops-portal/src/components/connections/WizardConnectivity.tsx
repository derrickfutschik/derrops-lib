import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Globe, AlertTriangle, Archive } from 'lucide-react'

export type ConnectivityMode = 'direct-http' | 'sqs' | 'sqs-http'

interface Option {
  id: ConnectivityMode
  icon: React.ReactNode
  label: string
  description: string
  implemented: boolean
  note?: string
}

const OPTIONS: Option[] = [
  {
    id: 'direct-http',
    icon: <Globe className="h-5 w-5" />,
    label: 'Direct HTTP',
    description:
      'Platform calls your relay over HTTPS. The relay must be reachable from the internet.',
    implemented: true,
  },
  {
    id: 'sqs',
    icon: <Archive className="h-5 w-5" />,
    label: 'SQS',
    description:
      'Platform pushes jobs to an SQS queue. The relay polls outbound — no inbound connections required. Ideal for private networks and local dev.',
    implemented: true,
    note: 'IAM credential generation is not yet available. The queue will be created but access keys must be configured manually.',
  },
  {
    id: 'sqs-http',
    icon: (
      <span className="flex items-center gap-0.5">
        <Globe className="h-4 w-4" />
        <span className="text-xs font-bold">+</span>
        <Archive className="h-4 w-4" />
      </span>
    ),
    label: 'SQS + HTTP',
    description:
      'Platform uses HTTP when available, falls back to SQS on failure. For relays that may move between network contexts.',
    implemented: false,
  },
]

interface WizardConnectivityProps {
  value: ConnectivityMode | null
  onChange: (mode: ConnectivityMode) => void
}

export function WizardConnectivity({ value, onChange }: WizardConnectivityProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        How will the SLAOps Platform deliver requests to your relay?
      </p>

      <div className="space-y-3">
        {OPTIONS.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'w-full text-left rounded-lg border p-4 transition-colors',
              value === opt.id
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/50',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-muted-foreground">{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground">{opt.label}</span>
                  {!opt.implemented && (
                    <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                      Not yet available
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{opt.description}</p>
                {opt.implemented && opt.note && value === opt.id && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-warning/10 border border-warning/20 p-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-warning">{opt.note}</p>
                  </div>
                )}
                {!opt.implemented && value === opt.id && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-warning/10 border border-warning/20 p-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-warning">
                      This option is not yet available. You can complete the wizard, but the connection
                      cannot be activated until this delivery mode is implemented.
                    </p>
                  </div>
                )}
              </div>
              <div
                className={cn(
                  'mt-1 h-4 w-4 rounded-full border-2 shrink-0',
                  value === opt.id ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                )}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
