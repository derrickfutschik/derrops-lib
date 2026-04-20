import { ArrowUp, ArrowDown, ArrowUpDown, EyeOff } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface SortableColHeaderProps {
  label: string
  field: string
  activeField: string
  activeDirection: 'asc' | 'desc'
  hideable?: boolean
  className?: string
  onSort: (field: string) => void
  onHide?: (field: string) => void
}

export function SortableColHeader({
  label,
  field,
  activeField,
  activeDirection,
  hideable = true,
  className,
  onSort,
  onHide,
}: SortableColHeaderProps) {
  const isActive = activeField === field

  const SortIcon = isActive
    ? activeDirection === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  return (
    <TableHead className={cn('group', className)}>
      <div className="flex items-center gap-1">
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => onSort(field)}
        >
          {label}
          <SortIcon
            className={cn('h-3 w-3', isActive ? 'text-foreground' : 'text-muted-foreground/40')}
          />
        </button>
        {hideable && onHide && (
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
            onClick={() => onHide(field)}
            title={`Hide ${label}`}
          >
            <EyeOff className="h-3 w-3 text-muted-foreground/60" />
          </button>
        )}
      </div>
    </TableHead>
  )
}
