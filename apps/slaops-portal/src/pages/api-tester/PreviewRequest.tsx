import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { RequestPreviewFormats } from '@/components/api-tester/RequestPreviewFormats'
import { FileCode, Minus, Plus, Route } from 'lucide-react'
import {
  selectCollapsedSections,
  toggleSection as toggleSectionAction,
} from '@/store/apiTesterSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'

interface PreviewRequestProps {
  method: string
  buildRequestPreview: () => {
    fullUrl: string
    previewHeaders: Record<string, string>
    bodyContent: string
  }
}

export function PreviewRequest({ method, buildRequestPreview }: PreviewRequestProps) {
  const dispatch = useAppDispatch()
  const collapsedSections = useAppSelector(selectCollapsedSections)
  const toggleSection = (section: string) => dispatch(toggleSectionAction(section))

  const preview = buildRequestPreview()
  const requestData = {
    method,
    url: preview.fullUrl,
    headers: preview.previewHeaders,
    body: preview.bodyContent || undefined,
  }

  const httpContent = (
    <div className="space-y-4">
      {/* Request Line */}
      <Collapsible
        open={!collapsedSections.previewRequestLine}
        onOpenChange={() => toggleSection('previewRequestLine')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Route className="h-4 w-4" />
            Request Line
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {collapsedSections.previewRequestLine ? (
                <Plus className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="bg-background rounded-lg p-3 border border-border mt-2">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
              <span
                className={
                  method === 'GET'
                    ? 'text-green-500'
                    : method === 'POST'
                      ? 'text-yellow-500'
                      : method === 'PUT'
                        ? 'text-blue-500'
                        : method === 'DELETE'
                          ? 'text-red-500'
                          : 'text-foreground'
                }
              >
                {method}
              </span>{' '}
              <span className="text-primary">{preview.fullUrl}</span>{' '}
              <span className="text-muted-foreground">HTTP/1.1</span>
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Request Headers */}
      <Collapsible
        open={!collapsedSections.previewHeaders}
        onOpenChange={() => toggleSection('previewHeaders')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCode className="h-4 w-4" />
            Headers
            <Badge variant="secondary" className="text-xs ml-1">
              {Object.keys(preview.previewHeaders).length}
            </Badge>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {collapsedSections.previewHeaders ? (
                <Plus className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="bg-background rounded-lg p-3 border border-border mt-2 overflow-x-auto">
            {Object.keys(preview.previewHeaders).length === 0 ? (
              <p className="text-muted-foreground text-sm">No headers</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-2 py-1 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-2 py-1 font-medium text-muted-foreground">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(preview.previewHeaders).map(([key, value], index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                    >
                      <td className="px-2 py-1 font-mono text-foreground">{key}</td>
                      <td className="px-2 py-1 font-mono text-muted-foreground break-all">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Request Body */}
      {preview.bodyContent && (
        <Collapsible
          open={!collapsedSections.previewBody}
          onOpenChange={() => toggleSection('previewBody')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileCode className="h-4 w-4" />
              Body
              <Badge variant="secondary" className="text-xs ml-1">
                {preview.bodyContent.length} chars
              </Badge>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {collapsedSections.previewBody ? (
                  <Plus className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="bg-background rounded-lg p-3 border border-border mt-2">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all max-h-[300px] overflow-auto">
                {preview.bodyContent}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )

  return <RequestPreviewFormats requestData={requestData} httpContent={httpContent} />
}
