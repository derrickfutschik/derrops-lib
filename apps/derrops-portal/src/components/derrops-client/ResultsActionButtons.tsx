import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlignLeft, BookOpen, Copy, Download, Fingerprint, WrapText } from 'lucide-react'
import { toast } from 'sonner'

type ViewMode = 'json' | 'markdown' | 'table'

interface ResultsActionButtonsProps {
  showText?: boolean
  viewMode: ViewMode
  isJson: boolean
  showFormatButton: boolean
  onFormat?: () => void
  truncateValues: boolean
  onToggleTruncateValues: () => void
  uniqueFilter: boolean
  duplicateCount: number
  highlightDuplicates: boolean
  onToggleUniqueFilter: () => void
  onHighlightDuplicatesChange: (val: boolean) => void
  responseSchema?: any
  onCopy: () => void
  onCopyJsonAsHtml: () => void
  onCopyCsvFromJson: () => void
  onGetTableMarkdown: () => string | null
  onGetTableCsv: () => string | null
  onGetTableJsCode: () => string | null
  onGetTableSql: () => string | null
  onCopyText: (text: string, label: string) => void
  onDownload: () => void
  onDownloadCsv: () => void
  onDownloadText: (text: string, filename: string, mimeType: string, label: string) => void
}

export function ResultsActionButtons({
  showText = false,
  viewMode,
  isJson,
  showFormatButton,
  onFormat,
  truncateValues,
  onToggleTruncateValues,
  uniqueFilter,
  duplicateCount,
  highlightDuplicates,
  onToggleUniqueFilter,
  onHighlightDuplicatesChange,
  responseSchema,
  onCopy,
  onCopyJsonAsHtml,
  onCopyCsvFromJson,
  onGetTableMarkdown,
  onGetTableCsv,
  onGetTableJsCode,
  onGetTableSql,
  onCopyText,
  onDownload,
  onDownloadCsv,
  onDownloadText,
}: ResultsActionButtonsProps) {
  const schemaButton = responseSchema && (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
          title="Schema"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {showText && <span>Schema</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] max-w-[90vw] p-0" align="end" side="bottom">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Response Schema</span>
        </div>
        <ScrollArea className="h-[400px]">
          <div className="p-3">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
              {JSON.stringify(responseSchema, null, 2)}
            </pre>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )

  return (
    <>
      {showFormatButton && onFormat && (
        <Button
          variant="outline"
          size="sm"
          className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
          onClick={onFormat}
          title="Format"
        >
          <AlignLeft className="h-3.5 w-3.5" />
          {showText && <span>Format</span>}
        </Button>
      )}
      {isJson && (
        <Button
          variant={truncateValues ? 'default' : 'outline'}
          size="sm"
          className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
          onClick={onToggleTruncateValues}
          title="Toggle value truncation (⌘I)"
        >
          <WrapText className="h-3.5 w-3.5" />
          {showText && <span>Truncate</span>}
        </Button>
      )}
      {isJson && (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Button
              variant={
                uniqueFilter && duplicateCount > 0
                  ? 'destructive'
                  : uniqueFilter || highlightDuplicates
                    ? 'default'
                    : 'outline'
              }
              size="sm"
              className={`${showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}${highlightDuplicates && !uniqueFilter ? ' border-amber-500 text-amber-500' : ''}`}
              onClick={onToggleUniqueFilter}
              title="Filter duplicate values (⌘U) — right-click for more options"
            >
              <Fingerprint className="h-3.5 w-3.5" />
              {showText && <span>Unique</span>}
            </Button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={onToggleUniqueFilter}>
              {uniqueFilter ? 'Show all (remove filter)' : 'Filter out duplicates'}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem
              checked={highlightDuplicates}
              onCheckedChange={onHighlightDuplicatesChange}
            >
              Highlight duplicates
            </ContextMenuCheckboxItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
      {schemaButton}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
            onClick={onCopy}
            title="Copy (right-click for more options)"
          >
            <Copy className="h-3.5 w-3.5" />
            {showText && <span>Copy</span>}
          </Button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {viewMode === 'json' && (
            <>
              <ContextMenuItem onClick={onCopy}>Copy JSON</ContextMenuItem>
              <ContextMenuItem onClick={onCopyJsonAsHtml}>
                Copy as HTML (with colors)
              </ContextMenuItem>
            </>
          )}
          {viewMode === 'table' && (
            <>
              <ContextMenuItem onClick={onCopy}>Copy as Table (Excel/Email)</ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  const md = onGetTableMarkdown()
                  if (md) onCopyText(md, 'Markdown')
                  else toast.error('No table data to copy')
                }}
              >
                Copy as Markdown
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  const csv = onGetTableCsv()
                  if (csv) onCopyText(csv, 'CSV')
                  else toast.error('No table data to copy')
                }}
              >
                Copy as CSV
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  const js = onGetTableJsCode()
                  if (js) onCopyText(js, 'Code')
                  else toast.error('No table data to copy')
                }}
              >
                Copy as Code
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  const sql = onGetTableSql()
                  if (sql) onCopyText(sql, 'SQL')
                  else toast.error('No table data to copy')
                }}
              >
                Copy as SQL
              </ContextMenuItem>
            </>
          )}
          {viewMode === 'markdown' && (
            <ContextMenuItem onClick={onCopy}>Copy Markdown</ContextMenuItem>
          )}
          {viewMode !== 'table' && viewMode !== 'json' && isJson && (
            <ContextMenuItem onClick={onCopyCsvFromJson}>Copy as CSV</ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={showText ? 'h-7 gap-1.5 text-xs' : 'h-7 w-7 p-0'}
            onClick={onDownload}
            title="Download (right-click for more options)"
          >
            <Download className="h-3.5 w-3.5" />
            {showText && <span>Download</span>}
          </Button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onDownload}>
            {viewMode === 'table'
              ? 'Download as CSV'
              : viewMode === 'markdown'
                ? 'Download as Markdown'
                : 'Download as JSON'}
          </ContextMenuItem>
          {viewMode === 'table' && (
            <>
              <ContextMenuItem
                onClick={() => {
                  const md = onGetTableMarkdown()
                  if (md) onDownloadText(md, 'response.md', 'text/markdown', 'Markdown')
                }}
              >
                Download as Markdown
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  const js = onGetTableJsCode()
                  if (js) onDownloadText(js, 'response.json', 'application/json', 'JSON')
                }}
              >
                Download as JSON
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  const sql = onGetTableSql()
                  if (sql) onDownloadText(sql, 'response.sql', 'text/plain', 'SQL')
                }}
              >
                Download as SQL
              </ContextMenuItem>
            </>
          )}
          {viewMode !== 'table' && isJson && (
            <ContextMenuItem onClick={onDownloadCsv}>Download as CSV</ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}
