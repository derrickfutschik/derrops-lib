import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Copy } from 'lucide-react'
import { useState } from 'react'

export type SqsOwnership = 'slaops' | 'custom'

interface WizardSqsSettingsProps {
  ownership: SqsOwnership
  onOwnershipChange: (o: SqsOwnership) => void
  customQueueUrl: string
  onCustomQueueUrlChange: (url: string) => void
  customRegion: string
  onCustomRegionChange: (region: string) => void
}

const SLAOPS_ACCOUNT_ID = '123456789012' // populated at runtime in production

function policySnippet(queueArn: string) {
  return JSON.stringify(
    {
      Sid: 'AllowSLAOpsSendMessage',
      Effect: 'Allow',
      Principal: { AWS: `arn:aws:iam::${SLAOPS_ACCOUNT_ID}:role/SLAOpsPlatformRole` },
      Action: 'sqs:SendMessage',
      Resource: queueArn || '<your-queue-arn>',
    },
    null,
    2,
  )
}

function queueUrlToArn(url: string, region: string): string {
  // https://sqs.<region>.amazonaws.com/<account>/<name>
  const parts = url.replace('https://sqs.', '').split('/')
  if (parts.length < 3) return '<your-queue-arn>'
  const account = parts[1]
  const name = parts[2]
  return `arn:aws:sqs:${region}:${account}:${name}`
}

export function WizardSqsSettings({
  ownership,
  onOwnershipChange,
  customQueueUrl,
  onCustomQueueUrlChange,
  customRegion,
  onCustomRegionChange,
}: WizardSqsSettingsProps) {
  const [copied, setCopied] = useState(false)

  const queueArn = customQueueUrl && customRegion
    ? queueUrlToArn(customQueueUrl, customRegion)
    : '<your-queue-arn>'

  const handleCopyPolicy = () => {
    navigator.clipboard.writeText(policySnippet(queueArn))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Ownership selector */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">Who manages the SQS queue?</p>
        <div className="grid grid-cols-2 gap-3">
          {(['slaops', 'custom'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => onOwnershipChange(mode)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                ownership === mode ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div className="font-medium text-sm text-foreground mb-1">
                {mode === 'slaops' ? 'SLAOps manages' : 'Bring your own'}
              </div>
              <p className="text-xs text-muted-foreground">
                {mode === 'slaops'
                  ? 'SLAOps creates and owns the FIFO queue in its AWS account.'
                  : 'You provide a FIFO queue in your own AWS account.'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* SLAOps-managed path */}
      {ownership === 'slaops' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Queue will be created automatically</p>
            <p className="text-xs font-mono">slaops--t-&#123;tenant-id&#125;--relay--cloud-relay--&#123;conn-id&#125;.fifo</p>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/20 p-3">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-xs text-warning space-y-1">
              <p className="font-medium">IAM credential generation not yet available.</p>
              <p>
                The queue will be created, but IAM access keys will not be generated automatically.
                You will need to configure relay queue access manually until this is implemented.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BYO queue path */}
      {ownership === 'custom' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/20 p-3">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-xs text-warning">
              BYO queue portal flow is not yet fully implemented.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="queue-url">Queue URL</Label>
            <Input
              id="queue-url"
              placeholder="https://sqs.ap-southeast-2.amazonaws.com/123456789012/my-relay.fifo"
              value={customQueueUrl}
              onChange={e => onCustomQueueUrlChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Must be an SQS FIFO queue (ending in .fifo)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="queue-region">Queue Region</Label>
            <Input
              id="queue-region"
              placeholder="ap-southeast-2"
              value={customRegion}
              onChange={e => onCustomRegionChange(e.target.value)}
            />
          </div>

          {customQueueUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Add to your queue resource policy:</p>
              <div className="relative rounded-md bg-muted/50 border p-3">
                <pre className="text-xs font-mono text-muted-foreground overflow-auto">
                  {policySnippet(queueArn)}
                </pre>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={handleCopyPolicy}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              {copied && <p className="text-xs text-success">Copied to clipboard</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
