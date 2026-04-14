import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { HelpCircle, Lock, Minus, Plus } from 'lucide-react'
import {
  selectCollapsedSections,
  toggleSection as toggleSectionAction,
} from '@/store/apiTesterSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { Service } from '@/client/slaops-cloud/models/service'
import type { OperationOption } from './types'

interface MatchModeSelectorPanelProps {
  matchMode: 'auto' | 'manual'
  onMatchModeChange: (mode: 'auto' | 'manual') => void
  selectedServiceId: string | null
  onSelectedServiceIdChange: (id: string | null) => void
  selectedOperationKey: string | null
  onSelectedOperationKeyChange: (key: string | null) => void
  services: Service[]
  availableOperations: OperationOption[]
}

export function MatchModeSelectorPanel({
  matchMode,
  onMatchModeChange,
  selectedServiceId,
  onSelectedServiceIdChange,
  selectedOperationKey,
  onSelectedOperationKeyChange,
  services,
  availableOperations,
}: MatchModeSelectorPanelProps) {
  const dispatch = useAppDispatch()
  const collapsedSections = useAppSelector(selectCollapsedSections)
  const toggleSection = (section: string) => dispatch(toggleSectionAction(section))

  return (
    <Collapsible
      open={!collapsedSections.apiMatch}
      onOpenChange={() => toggleSection('apiMatch')}
    >
      <div className="flex items-center justify-between py-2 border-b border-border">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {collapsedSections.apiMatch ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <div className="flex-1 flex items-center gap-2 ml-2">
          <span className="text-sm font-medium">API Match</span>
          <ToggleGroup
            type="single"
            value={matchMode}
            onValueChange={(value) => {
              if (value) onMatchModeChange(value as 'auto' | 'manual')
            }}
            className="h-6"
          >
            <ToggleGroupItem
              value="auto"
              className="h-6 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Auto
            </ToggleGroupItem>
            <ToggleGroupItem
              value="manual"
              className="h-6 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Manual
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <CollapsibleContent>
        <div className="space-y-3 py-3">
          {matchMode === 'auto' ? (
            <div className="text-sm text-muted-foreground">
              API service and operation will be automatically detected from the request URL.
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Select API Service</label>
                <Select
                  value={selectedServiceId || '__auto__'}
                  onValueChange={(value) => {
                    onSelectedServiceIdChange(value === '__auto__' ? null : value)
                    onSelectedOperationKeyChange(null)
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="__auto__">Select a service</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedServiceId && (
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground flex items-center gap-1">
                    Select Operation
                    {selectedOperationKey &&
                      (() => {
                        const selectedOp = availableOperations.find(
                          (op) => op.key === selectedOperationKey,
                        )
                        return (
                          <>
                            {selectedOp?.operationId && (
                              <span className="ml-1 font-mono text-foreground">
                                {selectedOp.operationId}
                              </span>
                            )}
                            {(selectedOp?.summary || selectedOp?.description) && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </PopoverTrigger>
                                <PopoverContent side="top" className="max-w-xs text-sm p-3">
                                  {selectedOp.summary && (
                                    <p className="font-medium">{selectedOp.summary}</p>
                                  )}
                                  {selectedOp.summary && selectedOp.description && <br />}
                                  {selectedOp.description && <p>{selectedOp.description}</p>}
                                </PopoverContent>
                              </Popover>
                            )}
                          </>
                        )
                      })()}
                  </label>
                  <Select
                    value={selectedOperationKey || '__auto__'}
                    onValueChange={(value) =>
                      onSelectedOperationKeyChange(value === '__auto__' ? null : value)
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select an operation">
                        {selectedOperationKey ? (
                          (() => {
                            const selectedOp = availableOperations.find(
                              (op) => op.key === selectedOperationKey,
                            )
                            return selectedOp ? (
                              <span>
                                <span
                                  className={`font-mono text-xs mr-2 ${
                                    selectedOp.method === 'GET'
                                      ? 'text-green-500'
                                      : selectedOp.method === 'POST'
                                        ? 'text-yellow-500'
                                        : selectedOp.method === 'PUT'
                                          ? 'text-blue-500'
                                          : selectedOp.method === 'DELETE'
                                            ? 'text-red-500'
                                            : 'text-muted-foreground'
                                  }`}
                                >
                                  {selectedOp.method}
                                </span>
                                <span className="font-mono text-sm text-foreground">
                                  {selectedOp.path}
                                </span>
                              </span>
                            ) : null
                          })()
                        ) : (
                          <span className="text-muted-foreground">Select an operation</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50 max-h-[300px]">
                      <SelectItem value="__auto__">Select an operation</SelectItem>
                      {availableOperations.map((op) => (
                        <SelectItem key={op.key} value={op.key}>
                          <span
                            className={`font-mono text-xs mr-2 ${
                              op.method === 'GET'
                                ? 'text-green-500'
                                : op.method === 'POST'
                                  ? 'text-yellow-500'
                                  : op.method === 'PUT'
                                    ? 'text-blue-500'
                                    : op.method === 'DELETE'
                                      ? 'text-red-500'
                                      : 'text-muted-foreground'
                            }`}
                          >
                            {op.method}
                          </span>
                          {op.operationId && (
                            <span className="font-mono text-sm mr-2">{op.operationId}</span>
                          )}
                          <span className="font-mono text-sm text-muted-foreground">{op.path}</span>
                          {op.summary && (
                            <span className="text-muted-foreground text-xs ml-2">
                              — {op.summary}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedServiceId && selectedOperationKey && (
                <div className="flex items-center gap-2 text-xs text-primary">
                  <Lock className="h-3 w-3" />
                  <span>Validation locked to selected operation</span>
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
