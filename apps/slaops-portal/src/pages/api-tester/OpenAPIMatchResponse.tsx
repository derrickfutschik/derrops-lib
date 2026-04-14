import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ExpandableParameterRow } from '@/components/api-tester/ExpandableParameterRow'
import { MobileExpandableParameter } from '@/components/api-tester/MobileExpandableParameter'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileCode,
  Minus,
  Plus,
  Route,
  Server,
} from 'lucide-react'
import {
  selectCollapsedSections,
  toggleSection as toggleSectionAction,
} from '@/store/apiTesterSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { MatchResult, ParameterInfo, SortColumn, SortDirection } from './types'

interface OpenAPIMatchResponseProps {
  matchResult: MatchResult | null
}

function sortParameters(
  params: ParameterInfo[],
  sortConfig: { column: SortColumn; direction: SortDirection },
): ParameterInfo[] {
  return [...params].sort((a, b) => {
    let comparison = 0
    switch (sortConfig.column) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'type':
        comparison = a.type.localeCompare(b.type)
        break
      case 'required':
        comparison = a.required === b.required ? 0 : a.required ? -1 : 1
        break
      case 'value': {
        const aVal = a.value || a.defaultValue || ''
        const bVal = b.value || b.defaultValue || ''
        comparison = aVal.localeCompare(bVal)
        break
      }
      case 'isValid': {
        const score = (p: ParameterInfo) => (!p.isValid ? 2 : p.isUnspecified ? 1 : 0)
        comparison = score(a) - score(b)
        break
      }
    }
    return sortConfig.direction === 'asc' ? comparison : -comparison
  })
}

function SortableHeader({
  column,
  label,
  currentSort,
  onSort,
}: {
  column: SortColumn
  label: string
  currentSort: { column: SortColumn; direction: SortDirection }
  onSort: (col: SortColumn) => void
}) {
  return (
    <th
      className="text-left px-3 py-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {currentSort.column === column ? (
          currentSort.direction === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </div>
    </th>
  )
}

type SortState = { column: SortColumn; direction: SortDirection }

function useParamSort(): [SortState, (col: SortColumn) => void] {
  const [sort, setSort] = useState<SortState>({ column: 'name', direction: 'asc' })
  const handleSort = (col: SortColumn) => {
    setSort((prev) =>
      prev.column === col
        ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column: col, direction: 'asc' },
    )
  }
  return [sort, handleSort]
}

function ParamTable({
  params,
  sort,
  onSort,
  isMobile,
}: {
  params: ParameterInfo[]
  sort: SortState
  onSort: (col: SortColumn) => void
  isMobile: boolean
}) {
  const sorted = sortParameters(params, sort)

  if (isMobile) {
    return (
      <div className="bg-background rounded-lg border border-border mt-2">
        <div className="space-y-2 p-3">
          {sorted.map((param, index) => (
            <MobileExpandableParameter
              key={index}
              name={param.name}
              type={param.type}
              required={param.required}
              value={param.value}
              defaultValue={param.defaultValue}
              isUsingDefault={param.isUsingDefault}
              isUnspecified={param.isUnspecified}
              isValid={param.isValid}
              validationReason={param.validationReason}
              description={param.description}
              rawJson={param.rawJson}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background rounded-lg p-4 border border-border mt-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <SortableHeader column="name" label="Name" currentSort={sort} onSort={onSort} />
              <SortableHeader column="type" label="Type" currentSort={sort} onSort={onSort} />
              <SortableHeader column="required" label="Required" currentSort={sort} onSort={onSort} />
              <SortableHeader column="value" label="Value" currentSort={sort} onSort={onSort} />
              <SortableHeader column="isValid" label="Valid" currentSort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((param, index) => (
              <ExpandableParameterRow
                key={index}
                name={param.name}
                type={param.type}
                required={param.required}
                value={param.value}
                defaultValue={param.defaultValue}
                isUsingDefault={param.isUsingDefault}
                isUnspecified={param.isUnspecified}
                isValid={param.isValid}
                validationReason={param.validationReason}
                description={param.description}
                rawJson={param.rawJson}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InvalidBadge({ count }: { count: number }) {
  return (
    <Badge
      variant={count > 0 ? 'destructive' : 'default'}
      className={`text-xs ${count === 0 ? 'bg-green-600 hover:bg-green-700' : ''}`}
    >
      {count} invalid
    </Badge>
  )
}

function CollapseToggle({ collapsed }: { collapsed: boolean }) {
  return collapsed ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />
}

export function OpenAPIMatchResponse({ matchResult }: OpenAPIMatchResponseProps) {
  const dispatch = useAppDispatch()
  const collapsedSections = useAppSelector(selectCollapsedSections)
  const toggleSection = (section: string) => dispatch(toggleSectionAction(section))
  const isMobile = useIsMobile()

  const [showDescription, setShowDescription] = useState(false)
  const [pathSort, onSortPath] = useParamSort()
  const [querySort, onSortQuery] = useParamSort()
  const [headerSort, onSortHeader] = useParamSort()
  const [bodySort, onSortBody] = useParamSort()

  if (!matchResult) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Enter a URL and click &quot;Analyze&quot; to match against your OpenAPI specs</p>
      </div>
    )
  }

  if (!matchResult.matched) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <p className="text-foreground font-medium">No Match Found</p>
        <p className="text-muted-foreground text-sm mt-2">
          The request URL doesn&apos;t match any endpoint in your registered services
        </p>
      </div>
    )
  }

  const op = matchResult.operation!

  return (
    <div className="space-y-6">
      {/* Server */}
      <Collapsible
        open={!collapsedSections.server}
        onOpenChange={() => toggleSection('server')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Server className="h-4 w-4" />
            Server URL
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <CollapseToggle collapsed={!!collapsedSections.server} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="bg-background rounded-lg p-4 border border-border space-y-3 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Server Index:</span>
              <Badge variant="outline" className="font-mono">
                {matchResult.server?.index}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">URL Template:</p>
              <code className="text-sm text-primary">{matchResult.server?.url}</code>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Resolved URL:</p>
              <code className="text-sm text-foreground">{matchResult.server?.resolvedUrl}</code>
            </div>
            {matchResult.server?.description && (
              <p className="text-sm text-muted-foreground italic">
                {matchResult.server.description}
              </p>
            )}
            {matchResult.server?.variables && matchResult.server.variables.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-sm font-medium text-muted-foreground mb-2">Server Variables</p>
                <div className="rounded border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Value</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchResult.server.variables.map((variable, index) => (
                        <tr
                          key={index}
                          className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                        >
                          <td className="px-3 py-2 font-mono text-foreground">{variable.name}</td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="font-mono">
                              {variable.value}
                            </Badge>
                            {variable.default && variable.value === variable.default && (
                              <span className="text-xs text-muted-foreground ml-2">(default)</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {variable.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Operation */}
      <Collapsible
        open={!collapsedSections.operation}
        onOpenChange={() => toggleSection('operation')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Route className="h-4 w-4" />
            Operation
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <CollapseToggle collapsed={!!collapsedSections.operation} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="bg-background rounded-lg p-4 border border-border space-y-3 mt-2">
            <div className="flex items-center gap-3">
              <Badge
                className={
                  op.method === 'GET'
                    ? 'bg-green-600 hover:bg-green-700'
                    : op.method === 'POST'
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : op.method === 'PUT'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : op.method === 'DELETE'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-muted'
                }
              >
                {op.method}
              </Badge>
              <code className="text-foreground font-medium">{op.path}</code>
            </div>
            {op.operationId && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Operation ID:</span>
                <code className="text-sm text-primary">{op.operationId}</code>
              </div>
            )}
            {op.summary && <p className="text-sm text-muted-foreground">{op.summary}</p>}
            {op.description && (
              <Collapsible open={showDescription} onOpenChange={setShowDescription}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-auto text-primary hover:text-primary/80"
                  >
                    {showDescription ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Hide description
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Show description
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                    {op.description}
                  </p>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Path Parameters */}
      {op.pathParameters && op.pathParameters.length > 0 && (
        <Collapsible
          open={!collapsedSections.pathParams}
          onOpenChange={() => toggleSection('pathParams')}
        >
          <div className="flex items-center justify-between">
            {(() => {
              const invalid = op.pathParameters.filter((p) => !p.isValid).length
              return (
                <div
                  className={`flex items-center gap-2 text-sm ${invalid > 0 ? 'text-destructive' : 'text-green-500'}`}
                >
                  <Route className="h-4 w-4" />
                  Path Parameters
                  <Badge variant="secondary" className="text-xs ml-1">
                    {op.pathParameters.length}
                  </Badge>
                  <InvalidBadge count={invalid} />
                </div>
              )
            })()}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <CollapseToggle collapsed={!!collapsedSections.pathParams} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <ParamTable params={op.pathParameters} sort={pathSort} onSort={onSortPath} isMobile={isMobile} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Query Parameters */}
      {op.queryParameters && op.queryParameters.length > 0 && (
        <Collapsible
          open={!collapsedSections.queryParams}
          onOpenChange={() => toggleSection('queryParams')}
        >
          <div className="flex items-center justify-between">
            {(() => {
              const invalid = op.queryParameters.filter((p) => !p.isValid).length
              return (
                <div
                  className={`flex items-center gap-2 text-sm ${invalid > 0 ? 'text-destructive' : 'text-green-500'}`}
                >
                  <FileCode className="h-4 w-4" />
                  Query Parameters
                  <Badge variant="secondary" className="text-xs ml-1">
                    {op.queryParameters.length}
                  </Badge>
                  <InvalidBadge count={invalid} />
                </div>
              )
            })()}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <CollapseToggle collapsed={!!collapsedSections.queryParams} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <ParamTable params={op.queryParameters} sort={querySort} onSort={onSortQuery} isMobile={isMobile} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Header Parameters */}
      {op.headerParameters && op.headerParameters.length > 0 && (
        <Collapsible
          open={!collapsedSections.headerParams}
          onOpenChange={() => toggleSection('headerParams')}
        >
          <div className="flex items-center justify-between">
            {(() => {
              const invalid = op.headerParameters.filter((p) => !p.isValid).length
              return (
                <div
                  className={`flex items-center gap-2 text-sm ${invalid > 0 ? 'text-destructive' : 'text-green-500'}`}
                >
                  <FileCode className="h-4 w-4" />
                  Header Parameters
                  <Badge variant="secondary" className="text-xs ml-1">
                    {op.headerParameters.length}
                  </Badge>
                  <InvalidBadge count={invalid} />
                </div>
              )
            })()}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <CollapseToggle collapsed={!!collapsedSections.headerParams} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <ParamTable params={op.headerParameters} sort={headerSort} onSort={onSortHeader} isMobile={isMobile} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Body Properties */}
      {op.bodyProperties && op.bodyProperties.length > 0 && (
        <Collapsible
          open={!collapsedSections.bodyParams}
          onOpenChange={() => toggleSection('bodyParams')}
        >
          <div className="flex items-center justify-between">
            {(() => {
              const invalid = op.bodyProperties.filter((p) => !p.isValid).length
              return (
                <div
                  className={`flex items-center gap-2 text-sm ${invalid > 0 ? 'text-destructive' : 'text-green-500'}`}
                >
                  <FileCode className="h-4 w-4" />
                  Body Properties
                  {op.bodyContentType && (
                    <Badge variant="outline" className="text-xs ml-1">
                      {op.bodyContentType}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs ml-1">
                    {op.bodyProperties.length}
                  </Badge>
                  <InvalidBadge count={invalid} />
                </div>
              )
            })()}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <CollapseToggle collapsed={!!collapsedSections.bodyParams} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <ParamTable
              params={op.bodyProperties.map((p) => ({
                ...p,
                value: p.value !== null ? JSON.stringify(p.value) : null,
                isUsingDefault: false,
                isUnspecified: false,
              }))}
              sort={bodySort}
              onSort={onSortBody}
              isMobile={isMobile}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Validation */}
      <Collapsible
        open={!collapsedSections.validation}
        onOpenChange={() => toggleSection('validation')}
      >
        <div className="flex items-center justify-between">
          <div
            className={`flex items-center gap-2 text-sm ${
              matchResult.validationErrors.length > 0
                ? 'text-destructive'
                : matchResult.validationWarnings.length > 0
                  ? 'text-orange-500'
                  : 'text-green-500'
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            Validation
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <CollapseToggle collapsed={!!collapsedSections.validation} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="bg-background rounded-lg p-4 border border-border mt-2 space-y-4">
            {matchResult.validationErrors.length === 0 &&
            matchResult.validationWarnings.length === 0 ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-4 w-4" />
                <span>Request is valid</span>
              </div>
            ) : (
              <>
                {matchResult.validationErrors.length > 0 && (
                  <ul className="space-y-2">
                    {matchResult.validationErrors.map((error, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-destructive text-sm min-w-0"
                      >
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="flex-1 min-w-0 break-words">{error}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {matchResult.validationWarnings.length > 0 && (
                  <ul className="space-y-2">
                    {matchResult.validationWarnings.map((warning, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-orange-500 text-sm min-w-0"
                      >
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="flex-1 min-w-0 break-words">{warning}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
