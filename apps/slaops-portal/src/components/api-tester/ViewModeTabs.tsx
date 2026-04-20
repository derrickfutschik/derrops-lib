import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Code, FileSpreadsheet, FileText } from 'lucide-react'
import React from 'react'

type ViewMode = 'json' | 'markdown' | 'table'

export interface ViewModeTabsProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  viewValidity: { json: boolean; markdown: boolean; table: boolean }
}

export function ViewModeTabs({ viewMode, onViewModeChange, viewValidity }: ViewModeTabsProps) {
  const viewModeOptions: {
    value: ViewMode
    label: string
    icon: React.ReactNode
    valid: boolean
  }[] = [
    { value: 'json', label: 'JSON', icon: <Code className="h-3 w-3" />, valid: viewValidity.json },
    {
      value: 'markdown',
      label: 'Markdown',
      icon: <FileText className="h-3 w-3" />,
      valid: viewValidity.markdown,
    },
    {
      value: 'table',
      label: 'Table',
      icon: <FileSpreadsheet className="h-3 w-3" />,
      valid: viewValidity.table,
    },
  ]

  return (
    <Select value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)}>
      <SelectTrigger className="h-6 w-auto gap-1.5 px-2 text-xs border-none bg-transparent hover:bg-accent focus:ring-0 focus:ring-offset-0 [&>svg:last-child]:h-3 [&>svg:last-child]:w-3 [&>svg:last-child]:opacity-50">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {viewModeOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            <div className="flex items-center gap-2">
              <span className={opt.valid ? 'text-foreground' : 'text-muted-foreground/50'}>
                {opt.icon}
              </span>
              <span className={opt.valid ? 'text-foreground' : 'text-muted-foreground/50'}>
                {opt.label}
              </span>
              {opt.valid && <span className="h-1.5 w-1.5 rounded-full bg-primary ml-1" />}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
