import { Button } from '@/components/ui/button'
import { PAGE_SIZE } from '@/config'

interface TabTableFooterProps {
  total: number
  from: number
  page: number
  entity: string
  hasFilter?: boolean
  onPrev: () => void
  onNext: () => void
}

export function TabTableFooter({
  total,
  from,
  page,
  entity,
  hasFilter,
  onPrev,
  onNext,
}: TabTableFooterProps) {
  const size = PAGE_SIZE
  const to = Math.min(from + size, total)
  const totalPages = Math.max(1, Math.ceil(total / size))
  const currentPage = page + 1

  const statusLabel =
    total === 0
      ? `0 ${entity}`
      : hasFilter
        ? `${to - from} of ${total} ${entity}`
        : total <= size
          ? `${total} ${entity}`
          : `${from + 1}–${to} of ${total} ${entity}`

  return (
    <div className="border-t border-border mt-2 pt-2 space-y-1">
      <p className="text-xs text-muted-foreground px-1">{statusLabel}</p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onPrev} disabled={page === 0}>
            &lsaquo; Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button variant="ghost" size="sm" onClick={onNext} disabled={currentPage >= totalPages}>
            Next &rsaquo;
          </Button>
        </div>
      )}
    </div>
  )
}
