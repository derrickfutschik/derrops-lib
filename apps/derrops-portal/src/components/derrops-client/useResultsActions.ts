import jmespath from 'jmespath'
import { useRef } from 'react'
import { toast } from 'sonner'
import {
  applyTruncationToJson,
  jsonToStyledHtml,
  writeHtmlToClipboard,
  writeTextToClipboard,
} from './json-copy-utils'

type ViewMode = 'json' | 'markdown' | 'table'

interface UseResultsActionsOptions {
  viewMode: ViewMode
  content: string
  isJson: boolean
  jmespathEnabled: boolean
  jmespathQuery: string
  jmespathMode: 'filter' | 'highlight'
  debouncedQuery: string
  truncateValues: boolean
  displayContentRef: React.MutableRefObject<string>
  tableDataRef: React.MutableRefObject<{ columns: string[]; rows: string[][] } | null>
  sqlResultRef: React.MutableRefObject<{ columns: string[]; rows: string[][] } | null>
  hiddenColumnIds: Set<string>
  sqlQuery: string
}

export function useResultsActions({
  viewMode,
  content,
  isJson,
  jmespathEnabled,
  jmespathQuery,
  jmespathMode,
  debouncedQuery,
  truncateValues,
  displayContentRef,
  tableDataRef,
  sqlResultRef,
  hiddenColumnIds,
  sqlQuery,
}: UseResultsActionsOptions) {
  // Keep a stable ref to viewMode so callbacks don't need to re-bind on every render
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode

  // ── Content getters ──────────────────────────────────────────────────────────

  const getEffectiveContent = (): string => {
    if (jmespathEnabled && jmespathMode === 'filter' && debouncedQuery.trim() && isJson) {
      try {
        const parsed = JSON.parse(content)
        const result = jmespath.search(parsed, debouncedQuery)
        return JSON.stringify(result, null, 2)
      } catch {
        return content
      }
    }
    return content
  }

  const getEffectiveMarkdownContent = (): string | null => {
    const effective = getEffectiveContent()
    let mdContent = effective
    try {
      const parsed = JSON.parse(effective)
      if (typeof parsed === 'string') {
        mdContent = parsed
      } else if (Array.isArray(parsed) && parsed.length > 0) {
        if (parsed.every((item: any) => typeof item === 'string')) {
          mdContent = parsed.join('\n\n---\n\n')
        } else if (
          typeof parsed[0] === 'object' &&
          parsed[0] !== null &&
          !Array.isArray(parsed[0])
        ) {
          const columns = Array.from(new Set(parsed.flatMap((item: any) => Object.keys(item))))
          const escapeCell = (val: any) => {
            const str =
              val === null || val === undefined
                ? ''
                : typeof val === 'object'
                  ? JSON.stringify(val)
                  : String(val)
            return str.replace(/\|/g, '\\|').replace(/\n/g, ' ')
          }
          const headerRow = `| ${columns.join(' | ')} |`
          const separatorRow = `| ${columns.map(() => '---').join(' | ')} |`
          const dataRows = parsed.map(
            (item: any) => `| ${columns.map((col) => escapeCell(item[col])).join(' | ')} |`,
          )
          mdContent = [headerRow, separatorRow, ...dataRows].join('\n')
        } else {
          const escapeCell = (val: any) => {
            const str = val === null || val === undefined ? '' : String(val)
            return str.replace(/\|/g, '\\|').replace(/\n/g, ' ')
          }
          mdContent = [
            '| value |',
            '| --- |',
            ...parsed.map((v: any) => `| ${escapeCell(v)} |`),
          ].join('\n')
        }
      } else {
        return null
      }
    } catch {
      // Not JSON — use as-is
    }
    return mdContent
  }

  // ── Table data getters ───────────────────────────────────────────────────────

  const getTableData = (): { columns: string[]; rows: string[][] } | null => {
    const raw = sqlResultRef.current ?? tableDataRef.current ?? null
    if (!raw || hiddenColumnIds.size === 0) return raw
    const visibleIndices = raw.columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !hiddenColumnIds.has(c))
      .map(({ i }) => i)
    return {
      columns: visibleIndices.map((i) => raw.columns[i]),
      rows: raw.rows.map((row) => visibleIndices.map((i) => row[i])),
    }
  }

  const getTableTsv = (): string | null => {
    const data = getTableData()
    if (!data) return null
    return [data.columns.join('\t'), ...data.rows.map((row) => row.join('\t'))].join('\n')
  }

  const getTableCsv = (): string | null => {
    const data = getTableData()
    if (!data) return null
    const escape = (val: string) =>
      val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val
    return [
      data.columns.map(escape).join(','),
      ...data.rows.map((row) => row.map(escape).join(',')),
    ].join('\n')
  }

  const getTableMarkdown = (): string | null => {
    const data = getTableData()
    if (!data) return null
    const esc = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ')
    return [
      `| ${data.columns.map(esc).join(' | ')} |`,
      `| ${data.columns.map(() => '---').join(' | ')} |`,
      ...data.rows.map((row) => `| ${row.map(esc).join(' | ')} |`),
    ].join('\n')
  }

  const getTableJsCode = (): string | null => {
    const data = getTableData()
    if (!data) return null
    const objects = data.rows.map((row) => {
      const obj: Record<string, string> = {}
      data.columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return obj
    })
    return JSON.stringify(objects, null, 2)
  }

  const getTableSql = (tableName = 'table_name'): string | null => {
    const data = getTableData()
    if (!data) return null
    const escSql = (v: string) => v.replace(/'/g, "''")
    const cols = data.columns.map((c) => `"${c}"`).join(', ')
    return data.rows
      .map((row) => {
        const vals = row.map((v) => (v === '' ? 'NULL' : `'${escSql(v)}'`)).join(', ')
        return `INSERT INTO ${tableName} (${cols}) VALUES (${vals});`
      })
      .join('\n')
  }

  // ── Clipboard helpers ────────────────────────────────────────────────────────

  const copyText = (text: string, label: string): void => {
    writeTextToClipboard(text).then(
      () => toast.success(`Copied as ${label}`),
      () => toast.error('Failed to copy — check browser clipboard permissions'),
    )
  }

  // ── Download helpers ─────────────────────────────────────────────────────────

  const downloadText = (text: string, filename: string, mimeType: string, label: string): void => {
    const blob = new Blob([text], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Downloaded as ${label}`)
  }

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleCopy = (): void => {
    if (viewModeRef.current === 'table') {
      const tsv = getTableTsv()
      if (!tsv) {
        toast.error('No table data to copy')
        return
      }
      const data = getTableData()!
      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const headerCells = data.columns.map((c) => `<th>${esc(c)}</th>`).join('')
      const bodyRows = data.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
        .join('')
      const htmlTable = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
      writeHtmlToClipboard(htmlTable, tsv).then(
        () => toast.success('Copied table to clipboard'),
        () => toast.error('Failed to copy — check browser clipboard permissions'),
      )
      return
    }
    if (viewModeRef.current === 'markdown') {
      const md = getEffectiveMarkdownContent()
      if (md) {
        copyText(md, 'Markdown')
        return
      }
    }
    const jsonContent = truncateValues
      ? applyTruncationToJson(displayContentRef.current)
      : displayContentRef.current
    writeTextToClipboard(jsonContent).then(
      () =>
        toast.success(
          jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim()
            ? 'Copied filtered content to clipboard'
            : 'Copied to clipboard',
        ),
      () => toast.error('Failed to copy — check browser clipboard permissions'),
    )
  }

  const handleCopyJsonAsHtml = (): void => {
    const jsonContent = truncateValues
      ? applyTruncationToJson(displayContentRef.current)
      : displayContentRef.current
    const html = jsonToStyledHtml(jsonContent)
    writeHtmlToClipboard(html, jsonContent).then(
      () => toast.success('Copied as HTML with syntax highlighting'),
      () => toast.error('Failed to copy — check browser clipboard permissions'),
    )
  }

  const handleCopyCsvFromJson = (): void => {
    const effectiveContent = getEffectiveContent()
    try {
      const parsed = JSON.parse(effectiveContent)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        toast.error('CSV export requires a JSON array')
        return
      }
      const escape = (val: any) => {
        const str = val === null || val === undefined ? '' : String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }
      let csvContent: string
      if (typeof parsed[0] === 'object' && parsed[0] !== null && !Array.isArray(parsed[0])) {
        const keys = Array.from(
          new Set(parsed.flatMap((item: any) => Object.keys(item))),
        ) as string[]
        csvContent = [
          keys.map(escape).join(','),
          ...parsed.map((row: any) => keys.map((k) => escape(row[k])).join(',')),
        ].join('\n')
      } else {
        csvContent = ['value', ...parsed.map(escape)].join('\n')
      }
      copyText(csvContent, 'CSV')
    } catch {
      toast.error('Failed to parse JSON for CSV export')
    }
  }

  const handleDownload = (): void => {
    if (viewModeRef.current === 'table') {
      const csv = getTableCsv()
      if (!csv) {
        toast.error('No table data to download')
        return
      }
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = sqlQuery.trim() ? 'response-filtered.csv' : 'response.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Downloaded as CSV')
      return
    }
    if (viewModeRef.current === 'markdown') {
      const mdContent = getEffectiveMarkdownContent() ?? getEffectiveContent()
      downloadText(mdContent, 'response.md', 'text/markdown', 'Markdown')
      return
    }
    const effectiveContent = getEffectiveContent()
    const extension = isJson ? 'json' : 'txt'
    const mimeType = isJson ? 'application/json' : 'text/plain'
    const filename =
      jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim()
        ? `response-filtered.${extension}`
        : `response.${extension}`
    downloadText(
      effectiveContent,
      filename,
      mimeType,
      jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim()
        ? 'filtered response'
        : 'response',
    )
  }

  const handleDownloadCsv = (): void => {
    const effectiveContent = getEffectiveContent()
    try {
      const parsed = JSON.parse(effectiveContent)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        toast.error('CSV export requires a JSON array')
        return
      }
      const escape = (val: any) => {
        const str = val === null || val === undefined ? '' : String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }
      let csvContent: string
      if (typeof parsed[0] === 'object' && parsed[0] !== null && !Array.isArray(parsed[0])) {
        const keys = Array.from(new Set(parsed.flatMap((item: any) => Object.keys(item))))
        csvContent = [
          keys.map(escape).join(','),
          ...parsed.map((row: any) => keys.map((k: string) => escape(row[k])).join(',')),
        ].join('\n')
      } else {
        csvContent = ['value', ...parsed.map(escape)].join('\n')
      }
      const filename =
        jmespathEnabled && jmespathMode === 'filter' && jmespathQuery.trim()
          ? 'response-filtered.csv'
          : 'response.csv'
      downloadText(csvContent, filename, 'text/csv', 'CSV')
    } catch {
      toast.error('Failed to parse JSON for CSV export')
    }
  }

  return {
    getEffectiveContent,
    getEffectiveMarkdownContent,
    getTableData,
    getTableCsv,
    getTableMarkdown,
    getTableJsCode,
    getTableSql,
    copyText,
    downloadText,
    handleCopy,
    handleCopyJsonAsHtml,
    handleCopyCsvFromJson,
    handleDownload,
    handleDownloadCsv,
  }
}
