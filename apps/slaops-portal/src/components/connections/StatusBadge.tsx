import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusValue = 'active' | 'pending' | 'unreachable' | 'disabled' | string

const statusConfig: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-success/15 text-success border-success/30',
  },
  pending: {
    label: 'Pending setup',
    className: 'bg-muted text-muted-foreground border-border',
  },
  unreachable: {
    label: 'Unreachable',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  disabled: {
    label: 'Disabled',
    className: 'bg-muted/50 text-muted-foreground/60 border-border/50',
  },
}

export function StatusBadge({ status }: { status: StatusValue }) {
  const statusStr = typeof status === 'object' ? JSON.stringify(status) : String(status)
  const config = statusConfig[statusStr] ?? {
    label: statusStr,
    className: 'bg-muted text-muted-foreground border-border',
  }

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', config.className)}>
      {config.label}
    </Badge>
  )
}

export function TypeBadge({ type }: { type: string }) {
  const typeConfig: Record<string, string> = {
    'self-hosted': 'bg-primary/15 text-primary border-primary/30',
    managed: 'bg-chart-4/15 text-chart-4 border-chart-4/30',
    'local-dev': 'bg-warning/15 text-warning border-warning/30',
    relay: 'bg-primary/15 text-primary border-primary/30',
    aegis: 'bg-chart-4/15 text-chart-4 border-chart-4/30',
    local: 'bg-warning/15 text-warning border-warning/30',
  }

  const label: Record<string, string> = {
    'self-hosted': 'Self-hosted',
    managed: 'Managed',
    'local-dev': 'Local',
    relay: 'Relay',
    aegis: 'Aegis',
    local: 'Local',
  }

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', typeConfig[type] ?? '')}>
      {label[type] ?? type}
    </Badge>
  )
}
