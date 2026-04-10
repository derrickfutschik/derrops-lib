import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import { useState } from 'react'

interface WizardHttpSettingsProps {
  url: string
  onChange: (url: string) => void
}

export function WizardHttpSettings({ url, onChange }: WizardHttpSettingsProps) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const handleTest = async () => {
    if (!url) return
    setTesting(true)
    setTestResult(null)
    const start = Date.now()
    try {
      // Use a direct fetch for raw reachability — the relay URL isn't registered yet
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) })
      const ms = Date.now() - start
      setTestResult(res.ok ? { ok: true, msg: `Reachable — ${ms} ms` } : { ok: false, msg: `HTTP ${res.status}` })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setTestResult({ ok: false, msg })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the HTTPS base URL where your relay is reachable from the internet.
      </p>

      <div className="space-y-2">
        <Label htmlFor="relay-url">Relay URL</Label>
        <Input
          id="relay-url"
          placeholder="https://relay.example.com"
          value={url}
          onChange={e => onChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Must be HTTPS. The platform will call <code className="text-xs">/health</code> and{' '}
          <code className="text-xs">/cloud-relay/proxy</code> on this base URL.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!url || testing}
          onClick={handleTest}
        >
          {testing && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
          Test reachability
        </Button>
        {testResult && (
          <span className={`flex items-center gap-1.5 text-sm ${testResult.ok ? 'text-success' : 'text-destructive'}`}>
            {testResult.ok
              ? <CheckCircle className="h-4 w-4" />
              : <XCircle className="h-4 w-4" />
            }
            {testResult.msg}
          </span>
        )}
      </div>
    </div>
  )
}
