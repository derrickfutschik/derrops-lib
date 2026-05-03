import React from 'react'

interface JsonViewPanelProps {
  renderedContent: React.ReactNode
  preRef: React.RefObject<HTMLPreElement>
  padding?: string
}

export function JsonViewPanel({ renderedContent, preRef, padding = 'p-4' }: JsonViewPanelProps) {
  return (
    <pre
      ref={preRef}
      className={`text-sm font-mono text-foreground whitespace-pre-wrap break-all ${padding}`}
    >
      <code>{renderedContent}</code>
    </pre>
  )
}
