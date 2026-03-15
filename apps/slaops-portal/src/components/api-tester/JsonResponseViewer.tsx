import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, ChevronRight } from 'lucide-react'
import React, { useState } from 'react'

interface JsonResponseViewerProps {
  jsonString: string
  responseSchema: any
  validationErrors?: Record<string, string> // Map of field names to validation error messages
  onJmespathSelect?: (path: string) => void // Called on Cmd/Ctrl+click with JMESPath expression
  truncateValues?: boolean // When true, long string values are truncated; click to expand individually
}

interface PropertySchema {
  description?: string
  type?: string
  properties?: Record<string, PropertySchema>
  items?: PropertySchema
}

const TRUNCATE_LENGTH = 255

// Recursively get property schema from a path
const getPropertySchema = (
  schema: PropertySchema | undefined,
  path: string[],
): PropertySchema | undefined => {
  if (!schema || path.length === 0) return schema

  const [current, ...rest] = path

  // Handle array items
  if (schema.type === 'array' && schema.items) {
    return getPropertySchema(schema.items, path)
  }

  // Handle object properties
  if (schema.properties && schema.properties[current]) {
    if (rest.length === 0) {
      return schema.properties[current]
    }
    return getPropertySchema(schema.properties[current], rest)
  }

  return undefined
}

// Build child JMESPath from a parent path and a key or index
const childJmesPath = (parent: string, key: string | number): string => {
  if (typeof key === 'number') {
    return parent ? `${parent}[${key}]` : `[${key}]`
  }
  return parent ? `${parent}.${key}` : key
}

// Component for a string value that can be individually expanded when truncation is active
const TruncatableString: React.FC<{
  value: string
  truncateValues: boolean
  onJmespathSelect?: (path: string) => void
  jmesPath: string
}> = ({ value, truncateValues, onJmespathSelect, jmesPath }) => {
  const [expanded, setExpanded] = useState(false)
  const isTruncatable = truncateValues && value.length > TRUNCATE_LENGTH

  const handleClick = (e: React.MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && jmesPath && onJmespathSelect) {
      e.preventDefault()
      onJmespathSelect(jmesPath)
      return
    }
    if (isTruncatable && !expanded) {
      setExpanded(true)
    } else if (truncateValues && expanded) {
      setExpanded(false)
    }
  }

  const displayValue = isTruncatable && !expanded ? `${value.slice(0, TRUNCATE_LENGTH)}\u2026` : value
  const isClickable = onJmespathSelect || isTruncatable || (truncateValues && expanded)
  const titleText =
    isTruncatable && !expanded
      ? 'Click to expand | Cmd/Ctrl+click to use as JMESPath'
      : truncateValues && expanded
        ? 'Click to collapse | Cmd/Ctrl+click to use as JMESPath'
        : onJmespathSelect
          ? 'Cmd/Ctrl+click to use as JMESPath'
          : undefined

  return (
    <span
      className={`text-green-400 ${isClickable ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
      title={titleText}
    >
      "{displayValue}"
    </span>
  )
}

// Component for property key with popover tooltip
const PropertyKeyWithTooltip: React.FC<{
  keyName: string
  description?: string
  propType?: string
  validationError?: string
  truncated?: boolean
  onJmespathSelect?: (path: string) => void
  jmesPath: string
}> = ({ keyName, description, propType, validationError, truncated, onJmespathSelect, jmesPath }) => {
  const [open, setOpen] = useState(false)
  const isRed = !!(validationError || truncated)

  const handleClick = (e: React.MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && onJmespathSelect) {
      e.preventDefault()
      onJmespathSelect(jmesPath)
    }
  }

  const keyElement = (
    <span
      className={`${isRed ? 'text-red-400' : 'text-purple-400'} ${onJmespathSelect ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
      title={onJmespathSelect ? 'Cmd/Ctrl+click to use as JMESPath' : undefined}
    >
      "{keyName}"
    </span>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className={`cursor-help border-b border-dashed ${
            isRed
              ? 'border-red-400/50 hover:border-red-400'
              : 'border-purple-400/50 hover:border-purple-400'
          }`}
        >
          {keyElement}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-[300px] text-sm p-2">
        <div className="space-y-1">
          {validationError && <div className="text-red-400 font-medium">{validationError}</div>}
          {propType && (
            <div className="text-xs text-muted-foreground font-mono">Type: {propType}</div>
          )}
          {description && <div>{description}</div>}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Toggle button for collapsing/expanding scopes
const CollapseToggle: React.FC<{
  collapsed: boolean
  onClick: () => void
}> = ({ collapsed, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors align-middle"
    aria-label={collapsed ? 'Expand' : 'Collapse'}
  >
    {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
  </button>
)

// Collapsible array component
const CollapsibleArray: React.FC<{
  value: any[]
  schema: PropertySchema | undefined
  validationErrors: Record<string, string> | undefined
  path: string[]
  jmesPath: string
  indent: number
  onJmespathSelect?: (path: string) => void
  truncateValues?: boolean
}> = ({ value, schema, validationErrors, path, jmesPath, indent, onJmespathSelect, truncateValues }) => {
  const [collapsed, setCollapsed] = useState(false)
  const indentStr = '  '.repeat(indent)
  const nextIndent = indent + 1
  const nextIndentStr = '  '.repeat(nextIndent)
  const itemSchema = schema?.items

  if (value.length === 0) {
    return <span>[]</span>
  }

  if (collapsed) {
    return (
      <>
        <CollapseToggle collapsed={collapsed} onClick={() => setCollapsed(false)} />
        <span
          className="text-muted-foreground cursor-pointer hover:text-foreground"
          onClick={() => setCollapsed(false)}
        >
          {`[${value.length} item${value.length !== 1 ? 's' : ''}]`}
        </span>
      </>
    )
  }

  return (
    <>
      <CollapseToggle collapsed={collapsed} onClick={() => setCollapsed(true)} />
      {'[\n'}
      {value.map((item, index) => (
        <React.Fragment key={index}>
          {nextIndentStr}
          {renderJsonNode(
            item,
            itemSchema,
            validationErrors,
            [...path, String(index)],
            childJmesPath(jmesPath, index),
            nextIndent,
            onJmespathSelect,
            truncateValues,
          )}
          {index < value.length - 1 ? ',\n' : '\n'}
        </React.Fragment>
      ))}
      {indentStr}]
    </>
  )
}

// Collapsible object component
const CollapsibleObject: React.FC<{
  value: Record<string, any>
  schema: PropertySchema | undefined
  validationErrors: Record<string, string> | undefined
  path: string[]
  jmesPath: string
  indent: number
  onJmespathSelect?: (path: string) => void
  truncateValues?: boolean
}> = ({ value, schema, validationErrors, path, jmesPath, indent, onJmespathSelect, truncateValues }) => {
  const [collapsed, setCollapsed] = useState(false)
  const indentStr = '  '.repeat(indent)
  const nextIndent = indent + 1
  const nextIndentStr = '  '.repeat(nextIndent)
  const entries = Object.entries(value)

  if (entries.length === 0) {
    return <span>{'{}'}</span>
  }

  if (collapsed) {
    return (
      <>
        <CollapseToggle collapsed={collapsed} onClick={() => setCollapsed(false)} />
        <span
          className="text-muted-foreground cursor-pointer hover:text-foreground"
          onClick={() => setCollapsed(false)}
        >
          {`{${entries.length} key${entries.length !== 1 ? 's' : ''}}`}
        </span>
      </>
    )
  }

  return (
    <>
      <CollapseToggle collapsed={collapsed} onClick={() => setCollapsed(true)} />
      {'{\n'}
      {entries.map(([key, val], index) => {
        const propPath = [...path, key]
        const propJmesPath = childJmesPath(jmesPath, key)
        const propSchema = getPropertySchema(schema, [key])
        const description = propSchema?.description
        const propType = propSchema?.type
        const validationError = validationErrors?.[key]
        const isTruncatedValue = !!(truncateValues && typeof val === 'string' && val.length > TRUNCATE_LENGTH)
        const hasTooltip = description || validationError
        const isKeyRed = !!(validationError || isTruncatedValue)

        const plainKey = (
          <span
            className={`${isKeyRed ? 'text-red-400' : 'text-purple-400'} ${onJmespathSelect ? 'cursor-pointer' : ''}`}
            onClick={
              onJmespathSelect
                ? (e) => {
                    if (e.metaKey || e.ctrlKey) {
                      e.preventDefault()
                      onJmespathSelect(propJmesPath)
                    }
                  }
                : undefined
            }
            title={onJmespathSelect ? 'Cmd/Ctrl+click to use as JMESPath' : undefined}
          >
            "{key}"
          </span>
        )

        return (
          <React.Fragment key={key}>
            {nextIndentStr}
            {hasTooltip ? (
              <PropertyKeyWithTooltip
                keyName={key}
                description={description}
                propType={propType}
                validationError={validationError}
                truncated={isTruncatedValue}
                onJmespathSelect={onJmespathSelect}
                jmesPath={propJmesPath}
              />
            ) : (
              plainKey
            )}
            {': '}
            {renderJsonNode(val, propSchema, validationErrors, propPath, propJmesPath, nextIndent, onJmespathSelect, truncateValues)}
            {index < entries.length - 1 ? ',\n' : '\n'}
          </React.Fragment>
        )
      })}
      {indentStr}
      {'}'}
    </>
  )
}

// Render a JSON node — primitives inline, objects/arrays as collapsible components
const renderJsonNode = (
  value: any,
  schema: PropertySchema | undefined,
  validationErrors: Record<string, string> | undefined,
  path: string[] = [],
  jmesPath: string = '',
  indent: number = 0,
  onJmespathSelect?: (path: string) => void,
  truncateValues?: boolean,
): React.ReactNode => {
  const handlePrimitiveClick = (e: React.MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && jmesPath && onJmespathSelect) {
      e.preventDefault()
      onJmespathSelect(jmesPath)
    }
  }

  const clickProps = onJmespathSelect
    ? { onClick: handlePrimitiveClick, className: 'cursor-pointer', title: 'Cmd/Ctrl+click to use as JMESPath' }
    : {}

  if (value === null) {
    return <span className={`text-red-400 ${clickProps.className ?? ''}`} onClick={clickProps.onClick} title={clickProps.title}>null</span>
  }

  if (typeof value === 'boolean') {
    return <span className={`text-blue-400 ${clickProps.className ?? ''}`} onClick={clickProps.onClick} title={clickProps.title}>{value.toString()}</span>
  }

  if (typeof value === 'number') {
    return <span className={`text-amber-400 ${clickProps.className ?? ''}`} onClick={clickProps.onClick} title={clickProps.title}>{value}</span>
  }

  if (typeof value === 'string') {
    return (
      <TruncatableString
        value={value}
        truncateValues={truncateValues ?? false}
        onJmespathSelect={onJmespathSelect}
        jmesPath={jmesPath}
      />
    )
  }

  if (Array.isArray(value)) {
    return (
      <CollapsibleArray
        value={value}
        schema={schema}
        validationErrors={validationErrors}
        path={path}
        jmesPath={jmesPath}
        indent={indent}
        onJmespathSelect={onJmespathSelect}
        truncateValues={truncateValues}
      />
    )
  }

  if (typeof value === 'object') {
    return (
      <CollapsibleObject
        value={value}
        schema={schema}
        validationErrors={validationErrors}
        path={path}
        jmesPath={jmesPath}
        indent={indent}
        onJmespathSelect={onJmespathSelect}
        truncateValues={truncateValues}
      />
    )
  }

  return <span>{String(value)}</span>
}

const JsonResponseViewerComponent: React.FC<JsonResponseViewerProps> = ({
  jsonString,
  responseSchema,
  validationErrors,
  onJmespathSelect,
  truncateValues,
}) => {
  try {
    const parsed = JSON.parse(jsonString)
    return <>{renderJsonNode(parsed, responseSchema, validationErrors, [], '', 0, onJmespathSelect, truncateValues)}</>
  } catch {
    // If parsing fails, return the raw string
    return <>{jsonString}</>
  }
}

export const JsonResponseViewer = React.memo(JsonResponseViewerComponent)
JsonResponseViewer.displayName = 'JsonResponseViewer'
