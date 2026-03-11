import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'

interface ParameterRowProps {
  name: string
  type: string
  required: boolean
  value: string | null
  defaultValue?: string | null
  isUsingDefault: boolean
  isUnspecified?: boolean
  isValid: boolean
  validationReason: string
  description?: string
  rawJson: object
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

export function ExpandableParameterRow({
  name,
  type,
  required,
  value,
  defaultValue,
  isUsingDefault,
  isUnspecified = false,
  isValid,
  validationReason,
  description,
  rawJson,
}: ParameterRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasDetails = description || rawJson
  const defaultTab = description ? 'description' : 'raw'

  const displayValue = value ?? (isUsingDefault ? defaultValue : null)

  // Determine the styling based on state
  const getNameClassName = () => {
    if (isUnspecified) return 'text-orange-500'
    if (!isValid) return 'text-destructive'
    return 'text-foreground'
  }

  return (
    <>
      <tr
        className={`border-t border-border ${hasDetails && !isUnspecified ? 'cursor-pointer hover:bg-muted/30' : ''} ${isUnspecified ? 'bg-orange-500/5' : ''}`}
        onClick={() => hasDetails && !isUnspecified && setIsExpanded(!isExpanded)}
      >
        <td className={`px-3 py-2 font-mono ${getNameClassName()}`}>
          {isUnspecified ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1.5 cursor-help">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  {name}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>This parameter is not defined in the OpenAPI specification</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            name
          )}
        </td>
        <td className={`px-3 py-2 ${isUnspecified ? 'text-orange-500' : 'text-muted-foreground'}`}>
          {isUnspecified ? 'unknown' : type}
        </td>
        <td className="px-3 py-2">
          {isUnspecified ? (
            <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/50">
              Unspecified
            </Badge>
          ) : required ? (
            <Badge
              variant="destructive"
              className={`text-xs ${displayValue ? 'bg-destructive/30 text-destructive/70 hover:bg-destructive/40' : ''}`}
            >
              Required
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Optional
            </Badge>
          )}
        </td>
        <td
          className={`px-3 py-2 font-mono max-w-[200px] truncate ${isUnspecified ? 'text-orange-500' : ''}`}
        >
          {displayValue ? (
            isUsingDefault ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground/60 italic cursor-help">
                    {displayValue}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Default value from OpenAPI spec (not explicitly provided)</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className={isUnspecified ? 'text-orange-500' : 'text-foreground'}>
                {displayValue}
              </span>
            )
          ) : (
            <span className="text-muted-foreground italic">-</span>
          )}
        </td>
        <td className="px-3 py-2">
          {isUnspecified ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-xs cursor-help text-orange-500 border-orange-500/50"
                >
                  Warning
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Parameter not in specification - may be ignored by the API</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Badge
                  variant={isValid ? 'default' : 'destructive'}
                  className={`text-xs cursor-help ${isValid ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isValid ? 'Valid' : 'Invalid'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{validationReason}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </td>
      </tr>
      {isExpanded && hasDetails && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={5} className="px-3 py-3">
            <Tabs defaultValue={defaultTab} className="w-full" onClick={(e) => e.stopPropagation()}>
              <TabsList className="h-8">
                <TabsTrigger value="description" className="text-xs h-6" disabled={!description}>
                  Description
                </TabsTrigger>
                <TabsTrigger value="raw" className="text-xs h-6">
                  Raw JSON
                </TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-2">
                {description ? (
                  <div
                    className="text-sm prose prose-sm prose-invert max-w-none [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-foreground [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description available</p>
                )}
              </TabsContent>
              <TabsContent value="raw" className="mt-2">
                <pre className="text-xs bg-background p-3 rounded border border-border overflow-x-auto whitespace-pre-wrap break-all max-w-full">
                  <code className="text-foreground">{highlightJson(rawJson)}</code>
                </pre>
              </TabsContent>
            </Tabs>
          </td>
        </tr>
      )}
    </>
  )
}
