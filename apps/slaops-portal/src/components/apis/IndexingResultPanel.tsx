import type { IndexingResponse } from '@/types/indexer'

interface IndexingResultPanelProps {
  result: IndexingResponse
}

export function IndexingResultPanel({ result }: IndexingResultPanelProps) {
  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
        <p className="text-sm font-medium text-destructive">❌ Indexing failed</p>
        {result.errors.map((e, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            <span className="font-mono font-medium">{e.step}:</span> {e.message}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 space-y-2">
      <p className="text-sm font-medium text-green-800 dark:text-green-200">✅ Indexed successfully</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Version</span><span className="font-mono font-medium">{result.version}</span>
        <span>Operations</span><span className="font-medium">{result.counts.operations}</span>
        <span>Servers</span><span className="font-medium">{result.counts.servers}</span>
        <span>Parameters</span><span className="font-medium">{result.counts.parameters}</span>
        <span>Models</span><span className="font-medium">{result.counts.models}</span>
        <span>Duration</span><span className="font-medium">{(result.durationMs / 1000).toFixed(1)}s</span>
      </div>
      {result.errors.length > 0 && (
        <div className="pt-1 space-y-1">
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ {e.step}: {e.message}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
