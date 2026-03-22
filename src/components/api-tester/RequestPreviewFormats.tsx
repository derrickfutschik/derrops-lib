import React, { useMemo, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  type RequestData,
  type RequestFormat,
  REQUEST_FORMAT_LABELS,
  generateRequestFormat,
} from './request-format-generators'

interface RequestPreviewFormatsProps {
  requestData: RequestData
  /** Rich React content for the HTTP view */
  httpContent: React.ReactNode
}

const ALT_FORMATS: Exclude<RequestFormat, 'http'>[] = ['curl', 'axios', 'har']

// Simple syntax highlighting for bash/curl
function highlightBash(code: string): React.ReactNode {
  return code.split('\n').map((line, i) => {
    const parts: React.ReactNode[] = []
    let remaining = line

    // Highlight the command name at start
    if (i === 0) {
      const match = remaining.match(/^(curl)(\s)/)
      if (match) {
        parts.push(<span key="cmd" className="text-chart-4 font-semibold">{match[1]}</span>)
        remaining = remaining.slice(match[1].length)
      }
    }

    // Highlight flags like -X, -H, -d
    const flagRegex = /(-[A-Za-z]+)(\s)/g
    let lastIdx = 0
    let m: RegExpExecArray | null
    while ((m = flagRegex.exec(remaining)) !== null) {
      if (m.index > lastIdx) {
        parts.push(<span key={`t${i}-${lastIdx}`}>{remaining.slice(lastIdx, m.index)}</span>)
      }
      parts.push(<span key={`f${i}-${m.index}`} className="text-chart-4">{m[1]}</span>)
      parts.push(<span key={`s${i}-${m.index}`}>{m[2]}</span>)
      lastIdx = m.index + m[0].length
    }
    if (lastIdx < remaining.length) {
      // Highlight quoted strings
      const strPart = remaining.slice(lastIdx)
      const strParts = strPart.split(/('(?:[^'\\]|\\.)*')/g)
      strParts.forEach((sp, si) => {
        if (sp.startsWith("'") && sp.endsWith("'")) {
          parts.push(<span key={`str${i}-${si}`} className="text-chart-2">{sp}</span>)
        } else if (sp) {
          parts.push(<span key={`r${i}-${si}`}>{sp}</span>)
        }
      })
    }

    return (
      <React.Fragment key={i}>
        {parts.length > 0 ? parts : line}
        {i < code.split('\n').length - 1 ? '\n' : ''}
      </React.Fragment>
    )
  })
}

// Simple syntax highlighting for JavaScript (axios)
function highlightJS(code: string): React.ReactNode {
  const keywords = /\b(const|let|var|await|require|import|from|async|function)\b/g
  const strings = /(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g
  const comments = /(\/\/.*$)/gm
  const numbers = /\b(\d+)\b/g

  return code.split('\n').map((line, i) => {
    const tokens: { start: number; end: number; type: string }[] = []

    // Collect tokens
    let m: RegExpExecArray | null
    const kwRe = new RegExp(keywords.source, 'g')
    while ((m = kwRe.exec(line)) !== null) {
      tokens.push({ start: m.index, end: m.index + m[0].length, type: 'keyword' })
    }
    const strRe = new RegExp(strings.source, 'g')
    while ((m = strRe.exec(line)) !== null) {
      tokens.push({ start: m.index, end: m.index + m[0].length, type: 'string' })
    }
    const cmtRe = new RegExp(comments.source, 'gm')
    while ((m = cmtRe.exec(line)) !== null) {
      tokens.push({ start: m.index, end: m.index + m[0].length, type: 'comment' })
    }
    const numRe = new RegExp(numbers.source, 'g')
    while ((m = numRe.exec(line)) !== null) {
      tokens.push({ start: m.index, end: m.index + m[0].length, type: 'number' })
    }

    // Sort by start, filter overlaps
    tokens.sort((a, b) => a.start - b.start)
    const filtered: typeof tokens = []
    let lastEnd = 0
    for (const t of tokens) {
      if (t.start >= lastEnd) {
        filtered.push(t)
        lastEnd = t.end
      }
    }

    const parts: React.ReactNode[] = []
    let pos = 0
    for (const t of filtered) {
      if (t.start > pos) {
        parts.push(<span key={`p${i}-${pos}`}>{line.slice(pos, t.start)}</span>)
      }
      const cls =
        t.type === 'keyword' ? 'text-chart-4 font-semibold' :
        t.type === 'string' ? 'text-chart-2' :
        t.type === 'comment' ? 'text-muted-foreground/40 italic' :
        t.type === 'number' ? 'text-chart-3' : ''
      parts.push(<span key={`t${i}-${t.start}`} className={cls}>{line.slice(t.start, t.end)}</span>)
      pos = t.end
    }
    if (pos < line.length) {
      parts.push(<span key={`e${i}`}>{line.slice(pos)}</span>)
    }

    return (
      <React.Fragment key={i}>
        {parts}
        {i < code.split('\n').length - 1 ? '\n' : ''}
      </React.Fragment>
    )
  })
}

// JSON syntax highlighting
function highlightJSON(code: string): React.ReactNode {
  return code.split('\n').map((line, i) => {
    const parts: React.ReactNode[] = []
    // Match JSON keys, strings, numbers, booleans, null
    const jsonTokens = /("(?:[^"\\]|\\.)*")(\s*:)?|(\b\d+\.?\d*\b)|(\btrue\b|\bfalse\b)|(\bnull\b)/g
    let lastIdx = 0
    let m: RegExpExecArray | null
    while ((m = jsonTokens.exec(line)) !== null) {
      if (m.index > lastIdx) {
        parts.push(<span key={`w${i}-${lastIdx}`}>{line.slice(lastIdx, m.index)}</span>)
      }
      if (m[1] && m[2]) {
        // Key
        parts.push(<span key={`k${i}-${m.index}`} className="text-chart-4">{m[1]}</span>)
        parts.push(<span key={`c${i}-${m.index}`} className="text-muted-foreground/50">{m[2]}</span>)
      } else if (m[1]) {
        // String value
        parts.push(<span key={`s${i}-${m.index}`} className="text-chart-2">{m[1]}</span>)
      } else if (m[3]) {
        // Number
        parts.push(<span key={`n${i}-${m.index}`} className="text-chart-3">{m[3]}</span>)
      } else if (m[4]) {
        // Boolean
        parts.push(<span key={`b${i}-${m.index}`} className="text-chart-3">{m[4]}</span>)
      } else if (m[5]) {
        // Null
        parts.push(<span key={`nl${i}-${m.index}`} className="text-muted-foreground/50">{m[5]}</span>)
      }
      lastIdx = m.index + m[0].length
    }
    if (lastIdx < line.length) {
      parts.push(<span key={`r${i}`}>{line.slice(lastIdx)}</span>)
    }
    return (
      <React.Fragment key={i}>
        {parts.length > 0 ? parts : line}
        {i < code.split('\n').length - 1 ? '\n' : ''}
      </React.Fragment>
    )
  })
}

function highlightCode(format: Exclude<RequestFormat, 'http'>, code: string): React.ReactNode {
  switch (format) {
    case 'curl': return highlightBash(code)
    case 'axios': return highlightJS(code)
    case 'har': return highlightJSON(code)
  }
}

type ActiveFormat = 'http' | 'http-raw' | Exclude<RequestFormat, 'http'>

const TAB_ORDER: { key: ActiveFormat; label: string }[] = [
  { key: 'http', label: 'HTTP' },
  { key: 'http-raw', label: 'HTTP (raw)' },
  { key: 'curl', label: REQUEST_FORMAT_LABELS.curl },
  { key: 'axios', label: REQUEST_FORMAT_LABELS.axios },
  { key: 'har', label: REQUEST_FORMAT_LABELS.har },
]

export function RequestPreviewFormats({ requestData, httpContent }: RequestPreviewFormatsProps) {
  const [activeFormat, setActiveFormat] = useState<ActiveFormat>('http')
  const [copied, setCopied] = useState(false)

  const httpRaw = useMemo(() => generateRequestFormat('http', requestData), [requestData])

  const formatted = useMemo(() => {
    if (activeFormat === 'http' || activeFormat === 'http-raw') return null
    return generateRequestFormat(activeFormat, requestData)
  }, [activeFormat, requestData])

  const highlighted = useMemo(
    () => (activeFormat !== 'http' && activeFormat !== 'http-raw' && formatted)
      ? highlightCode(activeFormat, formatted)
      : null,
    [activeFormat, formatted],
  )

  const handleCopy = useCallback(() => {
    const text = (activeFormat === 'http' || activeFormat === 'http-raw') ? httpRaw : formatted!
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    })
  }, [formatted, httpRaw, activeFormat])

  const showCopy = activeFormat !== 'http'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFormat(tab.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                activeFormat === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {showCopy && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </div>

      {activeFormat === 'http' ? (
        httpContent
      ) : (
        <div className="bg-background rounded-lg border border-border overflow-auto max-h-[600px]">
          <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-all p-4">
            <code>{activeFormat === 'http-raw' ? httpRaw : highlighted}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
