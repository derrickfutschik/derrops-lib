import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

interface MobileExpandableParameterProps {
  name: string
  type: string
  required: boolean
  value: string | null
  defaultValue?: string | null
  isUsingDefault?: boolean
  isUnspecified?: boolean
  isValid: boolean
  validationReason?: string
  description?: string
  rawJson?: object
}

function highlightJson(json: object | null): React.ReactNode {
  if (!json) return 'No raw data available'

  const jsonString = JSON.stringify(json, null, 2)

  // Regex patterns for different JSON elements
  const patterns = [
    {
      regex: /("(?:[^"\\]|\\.)*")(\s*:)/g,
      replacement: '<span class="text-purple-400">$1</span>$2',
    }, // keys
    { regex: /:\s*("(?:[^"\\]|\\.)*")/g, replacement: ': <span class="text-green-400">$1</span>' }, // string values
    { regex: /:\s*(\d+\.?\d*)/g, replacement: ': <span class="text-amber-400">$1</span>' }, // numbers
    { regex: /:\s*(true|false)/g, replacement: ': <span class="text-blue-400">$1</span>' }, // booleans
    { regex: /:\s*(null)/g, replacement: ': <span class="text-red-400">$1</span>' }, // null
  ]

  let highlighted = jsonString
  patterns.forEach(({ regex, replacement }) => {
    highlighted = highlighted.replace(regex, replacement)
  })

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />
}

export function MobileExpandableParameter({
  name,
  type,
  required,
  value,
  defaultValue,
  isUsingDefault = false,
  isUnspecified = false,
  isValid,
  validationReason,
  description,
  rawJson,
}: MobileExpandableParameterProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasDetails = description || rawJson
  const defaultTab = description ? 'description' : 'raw'

  const displayValue = value ?? (isUsingDefault ? defaultValue : null)

  // Determine the background styling based on state
  const getContainerClassName = () => {
    if (isUnspecified) return 'bg-orange-500/10 border border-orange-500/30'
    if (!isValid) return 'bg-destructive/10 border border-destructive/30'
    return 'bg-muted/30'
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={`p-2 rounded text-xs ${getContainerClassName()}`}>
        <CollapsibleTrigger asChild disabled={!hasDetails || isUnspecified}>
          <div className={`${hasDetails && !isUnspecified ? 'cursor-pointer' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                {isUnspecified ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <span className="flex items-center gap-1.5 cursor-help font-mono font-medium text-orange-500">
                        <AlertTriangle className="h-3 w-3 text-orange-500 flex-shrink-0" />
                        <span className="truncate">{name}</span>
                      </span>
                    </PopoverTrigger>
                    <PopoverContent className="p-2">
                      <p className="text-sm">
                        This parameter is not defined in the OpenAPI specification
                      </p>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span
                    className={`font-mono font-medium truncate ${!isValid ? 'text-destructive' : ''}`}
                  >
                    {name}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={`text-xs flex-shrink-0 ${isUnspecified ? 'text-orange-500 border-orange-500/50' : ''}`}
                >
                  {isUnspecified ? 'unknown' : type}
                </Badge>
                {isUnspecified ? (
                  <Badge
                    variant="outline"
                    className="text-xs text-orange-500 border-orange-500/50 flex-shrink-0"
                  >
                    Unspecified
                  </Badge>
                ) : required ? (
                  <Badge
                    variant="destructive"
                    className={`text-xs flex-shrink-0 ${displayValue ? 'bg-destructive/30 text-destructive/70 hover:bg-destructive/40' : ''}`}
                  >
                    Required
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    Optional
                  </Badge>
                )}
              </div>
              {hasDetails && !isUnspecified && (
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
            <div className="mt-1 text-muted-foreground flex items-center gap-1">
              <span>Value:</span>
              {displayValue ? (
                isUsingDefault ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <span className="text-muted-foreground/60 italic cursor-help truncate">
                        {displayValue}
                      </span>
                    </PopoverTrigger>
                    <PopoverContent className="p-2">
                      <p className="text-sm">
                        Default value from OpenAPI spec (not explicitly provided)
                      </p>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span
                    className={`truncate ${isUnspecified ? 'text-orange-500' : isValid ? 'text-green-500' : 'text-destructive'}`}
                  >
                    {displayValue}
                  </span>
                )
              ) : (
                <span className="text-muted-foreground italic">-</span>
              )}
            </div>
            {!isUnspecified && (
              <div className="mt-1 flex items-center gap-1">
                <span className="text-muted-foreground">Status:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Badge
                      variant={isValid ? 'default' : 'destructive'}
                      className={`text-xs cursor-help ${isValid ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    >
                      {isValid ? 'Valid' : 'Invalid'}
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="p-2">
                    <p className="text-sm">
                      {validationReason ||
                        (isValid ? 'Parameter is valid' : 'Parameter is invalid')}
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {isUnspecified && (
              <div className="mt-1 flex items-center gap-1">
                <span className="text-muted-foreground">Status:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-xs cursor-help text-orange-500 border-orange-500/50"
                    >
                      Warning
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="p-2">
                    <p className="text-sm">
                      Parameter not in specification - may be ignored by the API
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          {hasDetails && (
            <div className="mt-3 pt-3 border-t border-border">
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="h-7 w-full justify-start">
                  <TabsTrigger
                    value="description"
                    className="text-xs h-5 px-2"
                    disabled={!description}
                  >
                    Description
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="text-xs h-5 px-2">
                    Raw JSON
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="description" className="mt-2">
                  {description ? (
                    <div
                      className="text-xs prose prose-sm prose-invert max-w-none [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-foreground [&_a]:text-primary [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: description }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No description available</p>
                  )}
                </TabsContent>
                <TabsContent value="raw" className="mt-2">
                  <pre className="text-xs bg-background p-2 rounded border border-border overflow-x-auto whitespace-pre-wrap break-all max-w-full">
                    <code className="text-foreground">{highlightJson(rawJson || null)}</code>
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
