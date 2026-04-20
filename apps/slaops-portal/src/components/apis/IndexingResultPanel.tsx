import type { ExtractionState, IndexingResponse, OaspecEntity } from '@/types/indexer'

interface IndexingResultPanelProps {
  result: IndexingResponse
}

const ENTITY_LABEL: Record<OaspecEntity, string> = {
  spec: 'Spec',
  server: 'Servers',
  operation: 'Operations',
  param: 'Parameters',
  model: 'Models',
}

function StateRow({ state }: { state: ExtractionState }) {
  const hasErrors = state.errors.length > 0
  return (
    <>
      <span className="text-muted-foreground">{ENTITY_LABEL[state.entity]}</span>
      <span className="font-medium tabular-nums">
        {state.indexed}
        {state.truncated && <span className="ml-1 text-amber-500 text-xs">truncated</span>}
      </span>
      {hasErrors && (
        <div className="col-span-2 space-y-0.5">
          {state.errors.map((e, i) => (
            <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ [{e.phase}] {e.message}
            </p>
          ))}
        </div>
      )}
    </>
  )
}

export function IndexingResultPanel({ result }: IndexingResultPanelProps) {
  if (!result.success) {
    const specState = result.states.find((s) => s.entity === 'spec')
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
        <p className="text-sm font-medium text-destructive">Indexing failed</p>
        {specState?.errors.map((e, i) => (
          <p key={i} className="text-xs text-muted-foreground font-mono">
            {e.message}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 space-y-3">
      <p className="text-sm font-medium text-green-800 dark:text-green-200">Indexed successfully</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Version</span>
        <span className="font-mono font-medium">{result.version}</span>

        {result.states.map((state) => (
          <StateRow key={state.entity} state={state} />
        ))}

        <span className="text-muted-foreground">Duration</span>
        <span className="font-medium">{(result.durationMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  )
}
