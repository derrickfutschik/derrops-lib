import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDebounce } from '@/hooks/useDebounce'
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

interface SpecUploadUrlTabProps {
  isPending: boolean
  initialUrl?: string
  initialContent?: string
  onSubmit: (content: string, filename: string) => Promise<void>
}

export function SpecUploadUrlTab({
  isPending,
  initialUrl,
  initialContent,
  onSubmit,
}: SpecUploadUrlTabProps) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [specContent, setSpecContent] = useState(initialContent ?? '')
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(initialContent ? 'success' : 'idle')

  const debouncedUrl = useDebounce(url, 500)

  useEffect(() => {
    if (!debouncedUrl) {
      setFetchStatus('idle')
      setSpecContent('')
      return
    }

    try {
      new URL(debouncedUrl)
    } catch {
      setFetchStatus('idle')
      setSpecContent('')
      return
    }

    // Skip fetch if the URL matches the pre-filled initial content (already loaded)
    if (debouncedUrl === initialUrl && initialContent) return

    let cancelled = false

    const run = async () => {
      setFetchStatus('loading')
      setSpecContent('')
      try {
        const { data } = await cloudAxios.get<{ rawContent: string }>(
          `${cloudApiConfig.basePath}/apis/info`,
          { params: { openapi_doc_url: debouncedUrl } },
        )
        if (!cancelled) {
          setSpecContent(data.rawContent)
          setFetchStatus('success')
        }
      } catch {
        if (!cancelled) setFetchStatus('error')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [debouncedUrl])

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="spec-url">OpenAPI document URL</Label>
        <Input
          id="spec-url"
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {fetchStatus === 'loading' && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Fetching spec…
          </p>
        )}
        {fetchStatus === 'error' && (
          <p className="text-xs text-destructive">
            Could not fetch the spec. Check the URL and try again.
          </p>
        )}
      </div>

      {fetchStatus === 'success' && (
        <>
          <Textarea
            placeholder="OpenAPI YAML or JSON"
            className="font-mono text-xs min-h-[160px]"
            value={specContent}
            onChange={(e) => setSpecContent(e.target.value)}
          />
          <Button
            className="w-full"
            onClick={() => onSubmit(specContent, 'spec.yaml')}
            disabled={!specContent.trim() || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Index
          </Button>
        </>
      )}
    </div>
  )
}
