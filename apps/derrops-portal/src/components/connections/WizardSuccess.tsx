import { Button } from '@/components/ui/button'
import type { CreateConnectionResponse } from '@/hooks/useConnectionsApi'
import { AlertTriangle, CheckCircle, Copy } from 'lucide-react'
import { useState } from 'react'
import { CopyButton } from './CopyButton'

interface WizardSuccessProps {
  result: CreateConnectionResponse
  onClose: () => void
}

export function WizardSuccess({ result, onClose }: WizardSuccessProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const hasOneTimeCredentials =
    result.iam_access_key_id_created ||
    result.iam_secret_access_key ||
    result.aegis_registration_token

  const sqsMode = result.sqs_queue_mode
  const hasSqs = !!result.sqs_queue_url

  const envVars = [
    `RELAY_ID=${result.id}`,
    hasSqs ? `SQS_QUEUE_URL=${result.sqs_queue_url}` : null,
    hasSqs && result.sqs_region ? `SQS_REGION=${result.sqs_region}` : null,
    result.iam_access_key_id_created
      ? `AWS_ACCESS_KEY_ID=${result.iam_access_key_id_created}`
      : null,
    result.iam_secret_access_key ? `AWS_SECRET_ACCESS_KEY=${result.iam_secret_access_key}` : null,
    'DERROPS_VENDOR_JWKS_URL=https://api.derrops.com/cloud-relay/.well-known/jwks.json',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-success">
        <CheckCircle className="h-5 w-5" />
        <span className="font-semibold">Connection created</span>
      </div>

      {/* Aegis registration token (shown first if present) */}
      {result.aegis_registration_token && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="font-medium text-sm">Aegis Registration Token</span>
          </div>
          <p className="text-xs text-muted-foreground">
            This token is shown <strong>once only</strong> and cannot be retrieved again.
          </p>
          <div className="flex items-center gap-2 rounded bg-muted/50 border px-3 py-2">
            <code className="text-xs font-mono flex-1 truncate">
              {result.aegis_registration_token}
            </code>
            <CopyButton text={result.aegis_registration_token} />
          </div>
          <p className="text-xs text-muted-foreground">
            Set on your Aegis deployment:{' '}
            <code className="text-xs">DERROPS_REGISTRATION_TOKEN=&#123;token&#125;</code>
          </p>
        </div>
      )}

      {/* IAM credentials (if present) */}
      {(result.iam_access_key_id_created || result.iam_secret_access_key) && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="font-medium text-sm">IAM Credentials (shown once)</span>
          </div>
          {result.iam_access_key_id_created && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Access Key ID</p>
              <div className="flex items-center gap-2 rounded bg-muted/50 border px-3 py-2">
                <code className="text-xs font-mono flex-1">{result.iam_access_key_id_created}</code>
                <CopyButton text={result.iam_access_key_id_created} />
              </div>
            </div>
          )}
          {result.iam_secret_access_key && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Secret Access Key</p>
              <div className="flex items-center gap-2 rounded bg-muted/50 border px-3 py-2">
                <code className="text-xs font-mono flex-1">
                  {revealed ? result.iam_secret_access_key : '••••••••••••••••••••••••••••'}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setRevealed((r) => !r)}
                >
                  {revealed ? 'Hide' : 'Show'}
                </Button>
                <CopyButton text={result.iam_secret_access_key} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connection ID */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Connection ID
        </p>
        <div className="flex items-center gap-2 rounded bg-muted/50 border px-3 py-2">
          <code className="text-xs font-mono flex-1">{result.id}</code>
          <CopyButton text={result.id} />
        </div>
      </div>

      {/* Relay env vars */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Relay environment variables
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={() => navigator.clipboard.writeText(envVars)}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy all
          </Button>
        </div>
        <div className="rounded bg-muted/50 border p-3">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre">{envVars}</pre>
        </div>
      </div>

      {/* Acknowledgement for one-time credentials */}
      {hasOneTimeCredentials && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span className="text-sm text-muted-foreground">
            I have saved the credentials shown above. I understand they cannot be retrieved again.
          </span>
        </label>
      )}

      <Button
        className="w-full"
        disabled={hasOneTimeCredentials ? !acknowledged : false}
        onClick={onClose}
      >
        Done
      </Button>
    </div>
  )
}
