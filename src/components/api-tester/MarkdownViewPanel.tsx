import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

class MarkdownErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Failed to render Markdown. The content may not be valid Markdown.
        </div>
      )
    }
    return this.props.children
  }
}

interface MarkdownViewPanelProps {
  /** The effective content (jmespath filtered or raw) */
  displayContent: string
}

function getEffectiveMarkdownContent(displayContent: string): string | null {
  let mdContent = displayContent
  try {
    const parsed = JSON.parse(displayContent)
    if (typeof parsed === 'string') {
      mdContent = parsed
    } else if (Array.isArray(parsed) && parsed.length > 0) {
      // Array of strings → join with horizontal rule separators
      if (parsed.every((item: any) => typeof item === 'string')) {
        mdContent = parsed.join('\n\n---\n\n')
      } else if (typeof parsed[0] === 'object' && parsed[0] !== null && !Array.isArray(parsed[0])) {
        const columns = Array.from(new Set(parsed.flatMap((item: any) => Object.keys(item))))
        const escapeCell = (val: any) => {
          const str = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
          return str.replace(/\|/g, '\\|').replace(/\n/g, ' ')
        }
        const headerRow = `| ${columns.join(' | ')} |`
        const separatorRow = `| ${columns.map(() => '---').join(' | ')} |`
        const dataRows = parsed.map((item: any) =>
          `| ${columns.map((col) => escapeCell(item[col])).join(' | ')} |`
        )
        mdContent = [headerRow, separatorRow, ...dataRows].join('\n')
      } else {
        const escapeCell = (val: any) => {
          const str = val === null || val === undefined ? '' : String(val)
          return str.replace(/\|/g, '\\|').replace(/\n/g, ' ')
        }
        mdContent = ['| value |', '| --- |', ...parsed.map((v: any) => `| ${escapeCell(v)} |`)].join('\n')
      }
    } else {
      return null
    }
  } catch {
    // Not JSON — use as-is
  }
  return mdContent
}

export function MarkdownViewPanel({ displayContent }: MarkdownViewPanelProps) {
  const mdContent = getEffectiveMarkdownContent(displayContent)

  if (mdContent === null) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Content is not valid Markdown. Switch to JSON view to see the data.
      </div>
    )
  }

  if (!mdContent || !mdContent.trim()) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No content to render as Markdown.
      </div>
    )
  }

  try {
    return (
      <MarkdownErrorBoundary key={mdContent}>
        <div className="prose prose-sm dark:prose-invert max-w-none p-4 prose-headings:text-primary prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-border prose-table:text-sm prose-th:text-primary prose-th:font-semibold prose-th:text-left prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2 prose-td:text-foreground prose-tr:border-b prose-tr:border-border prose-thead:border-b-2 prose-thead:border-primary/30">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{mdContent}</ReactMarkdown>
        </div>
      </MarkdownErrorBoundary>
    )
  } catch {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Failed to render Markdown. The content may not be valid Markdown.
      </div>
    )
  }
}
