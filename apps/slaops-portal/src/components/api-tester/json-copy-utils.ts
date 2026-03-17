import { TRUNCATE_LENGTH, TRUNCATE_ARRAY_LENGTH, TRUNCATE_ARRAY_OBJECT_LENGTH } from './JsonResponseViewer'

/** Write plain text to clipboard, with execCommand fallback for non-HTTPS contexts. */
export function writeTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise((resolve, reject) => {
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      ok ? resolve() : reject(new Error('execCommand failed'))
    } catch (e) {
      reject(e)
    }
  })
}

/** Write HTML + plain-text fallback to clipboard. Falls back to plain text if ClipboardItem unavailable. */
export function writeHtmlToClipboard(html: string, plainText: string): Promise<void> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const htmlBlob = new Blob([html], { type: 'text/html' })
    const textBlob = new Blob([plainText], { type: 'text/plain' })
    return navigator.clipboard
      .write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })])
      .catch(() => writeTextToClipboard(plainText))
  }
  return writeTextToClipboard(plainText)
}

// Colors matching JsonResponseViewer's Tailwind classes (converted to hex for inline styles)
const COLORS = {
  string: '#4ade80',   // text-green-400
  key: '#c084fc',      // text-purple-400
  number: '#fbbf24',   // text-amber-400
  boolean: '#60a5fa',  // text-blue-400
  null: '#f87171',     // text-red-400
  punctuation: '#e2e8f0',
  bg: '#0d1117',
  fg: '#e2e8f0',
}

function htmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function nodeToHtml(value: any, indent: number): string {
  const pad = '  '.repeat(indent)
  const nextPad = '  '.repeat(indent + 1)

  if (value === null) {
    return `<span style="color:${COLORS.null}">null</span>`
  }
  if (typeof value === 'boolean') {
    return `<span style="color:${COLORS.boolean}">${value}</span>`
  }
  if (typeof value === 'number') {
    return `<span style="color:${COLORS.number}">${htmlEsc(String(value))}</span>`
  }
  if (typeof value === 'string') {
    return `<span style="color:${COLORS.string}">"${htmlEsc(value)}"</span>`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value
      .map((item, i) => `${nextPad}${nodeToHtml(item, indent + 1)}${i < value.length - 1 ? ',' : ''}`)
      .join('\n')
    return `[\n${items}\n${pad}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    const items = entries
      .map(
        ([k, v], i) =>
          `${nextPad}<span style="color:${COLORS.key}">"${htmlEsc(k)}"</span>: ${nodeToHtml(v, indent + 1)}${i < entries.length - 1 ? ',' : ''}`,
      )
      .join('\n')
    return `{\n${items}\n${pad}}`
  }
  return htmlEsc(String(value))
}

/** Generate a self-contained HTML snippet with syntax highlighting matching JsonResponseViewer. */
export function jsonToStyledHtml(jsonStr: string): string {
  try {
    const parsed = JSON.parse(jsonStr)
    const body = nodeToHtml(parsed, 0)
    return `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;background:${COLORS.bg};color:${COLORS.fg};padding:16px;border-radius:6px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-all">${body}</pre>`
  } catch {
    return `<pre>${htmlEsc(jsonStr)}</pre>`
  }
}

function truncateValue(value: any): any {
  if (typeof value === 'string') {
    return value.length > TRUNCATE_LENGTH ? value.slice(0, TRUNCATE_LENGTH) + `… ${(value.length - TRUNCATE_LENGTH).toLocaleString()} more chars` : value
  }
  if (Array.isArray(value)) {
    const isObjArray = value.length > 0 && typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])
    const limit = isObjArray ? TRUNCATE_ARRAY_OBJECT_LENGTH : TRUNCATE_ARRAY_LENGTH
    const sliced = value.slice(0, limit).map(truncateValue)
    if (value.length > limit) {
      sliced.push(`… ${value.length - limit} more item${value.length - limit !== 1 ? 's' : ''}`)
    }
    return sliced
  }
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = truncateValue(v)
    }
    return result
  }
  return value
}

/** Apply the same value truncation rules as JsonResponseViewer. */
export function applyTruncationToJson(jsonStr: string): string {
  try {
    const parsed = JSON.parse(jsonStr)
    return JSON.stringify(truncateValue(parsed), null, 2)
  } catch {
    return jsonStr
  }
}
