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
}

interface ParsedQueueUrl {
  region: string
  accountId: string
  queueName: string
}

const QUEUE_URL_RE = /^https:\/\/sqs\.([\w-]+)\.amazonaws\.com\/(\d{12})\/([^/]+)$/
const SLAOPS_ACCOUNT_ID = '123456789012' // populated at runtime in production

export function parseQueueUrl(url: string): ParsedQueueUrl | null {
  const m = url.trim().match(QUEUE_URL_RE)
  if (!m) return null
  return { region: m[1], accountId: m[2], queueName: m[3] }
}

export function isValidByoQueueUrl(url: string): boolean {
  const parsed = parseQueueUrl(url)
  if (!parsed) return false
  if (!parsed.queueName.endsWith('.fifo')) return false
  return parsed.queueName === parsed.queueName.toLowerCase()
}

function queueUrlToArn(parsed: ParsedQueueUrl): string {
  return `arn:aws:sqs:${parsed.region}:${parsed.accountId}:${parsed.queueName}`
}

function policySnippet(queueArn: string) {
  return JSON.stringify(
    {
      Sid: 'AllowSLAOpsSendMessage',
      Effect: 'Allow',
      Principal: { AWS: `arn:aws:iam::${SLAOPS_ACCOUNT_ID}:role/SLAOpsPlatformRole` },
      Action: 'sqs:SendMessage',
      Resource: queueArn,
    },
    null,
    2,
  )
}

export function WizardSqsSettings({
  ownership,
  onOwnershipChange,
  customQueueUrl,
  onCustomQueueUrlChange,
}: WizardSqsSettingsProps) {
  const [copied, setCopied] = useState(false)

  const parsed = customQueueUrl.trim() ? parseQueueUrl(customQueueUrl) : null
  const urlEntered = customQueueUrl.trim().length > 0
  const urlInvalid = urlEntered && !parsed
  const nameNotLowercase = parsed && parsed.queueName !== parsed.queueName.toLowerCase()
  const notFifo = parsed && !parsed.queueName.endsWith('.fifo')
  const queueArn = parsed ? queueUrlToArn(parsed) : '<your-queue-arn>'

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
              className={urlInvalid ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {urlInvalid && (
              <p className="text-xs text-destructive">
                Invalid URL — expected https://sqs.&#123;region&#125;.amazonaws.com/&#123;account-id&#125;/&#123;name.fifo&#125;
              </p>
            )}
            {notFifo && (
              <p className="text-xs text-destructive">Queue name must end in .fifo</p>
            )}
            {nameNotLowercase && (
              <p className="text-xs text-destructive">Queue name must be all lowercase</p>
            )}
            {parsed && !notFifo && !nameNotLowercase && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1 font-mono">
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-20 shrink-0">Region</span>
                  <span>{parsed.region}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-20 shrink-0">Account ID</span>
                  <span>{parsed.accountId}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-20 shrink-0">Queue</span>
                  <span>{parsed.queueName}</span>
                </div>
              </div>
            )}
          </div>

          {parsed && !notFifo && !nameNotLowercase && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Add to your queue resource policy:</p>
              <div className="relative rounded-md bg-muted/50 border p-3">
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
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
