import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAppSelector } from '@/store/hooks'
import { selectInfoFetchStatus, selectInfoFetchResult } from '@/store/newApiWizardSlice'

export function InfoFetchFeedback() {
  const status = useAppSelector(selectInfoFetchStatus)
  const result = useAppSelector(selectInfoFetchResult)

  if (status === 'idle') return null

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Fetching spec info…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Couldn't read spec from this URL — fill in the fields manually.
      </div>
    )
  }

  if (status === 'success' && result) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          Found: <strong>{result.title}</strong>
          {result.version ? ` v${result.version}` : ''}
        </span>
      </div>
    )
  }

  return null
}
