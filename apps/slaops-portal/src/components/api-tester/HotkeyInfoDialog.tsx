import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

interface HotkeyInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Global',
    rows: [['⌘ ↵', 'Run main action (Request / Preview / Match)']],
  },
  {
    title: 'URL Input (Standard Mode)',
    rows: [
      ['↑ / ↓', 'Browse URL history'],
      ['Enter', 'Send request & save URL to history'],
      ['Esc', 'Close history / revert URL'],
      ['Double-click', 'Show URL history'],
    ],
  },
  {
    title: 'JSON Viewer',
    rows: [
      ['⌘ K', 'Toggle Highlight Mode'],
      ['⌘ J', 'Toggle Filter Mode'],
      ['⌘ 8', 'Wildcard array indices ([0] → [*])'],
      ['⌘ I', 'Toggle value truncation (click value to expand)'],
      ['⌘ U', 'Filter duplicate values (arrays only)'],
      ['⌘ A', 'Select all content'],
      ['⌘ Click', 'Use value as JMESPath expression'],
      ['⌘ Z', 'Undo JMESPath query change'],
      ['⌘ ⇧ Z / ⌘ Y', 'Redo JMESPath query change'],
    ],
  },
  {
    title: 'JMESPath Input',
    rows: [
      ['Tab / Enter', 'Accept autocomplete suggestion'],
      ['↑ / ↓', 'Navigate autocomplete suggestions'],
      ['Esc', 'Dismiss autocomplete'],
    ],
  },
  {
    title: 'Viewer Controls',
    rows: [
      ['↔', 'Expand to bottom panel'],
      ['⤢', 'Maximize / fullscreen'],
      ['⌘ H', 'Show this help (when viewer not focused)'],
    ],
  },
]

export function HotkeyInfoDialog({ open, onOpenChange }: HotkeyInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.rows.map(([key, desc]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50"
                  >
                    <span className="text-muted-foreground">{desc}</span>
                    <kbd className="ml-4 shrink-0 px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
