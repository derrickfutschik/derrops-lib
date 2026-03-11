import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, ChevronRight } from 'lucide-react'
import React, { useState } from 'react'

interface JsonResponseViewerProps {
  jsonString: string
  responseSchema: any
  validationErrors?: Record<string, string> // Map of field names to validation error messages
  onJmespathSelect?: (path: string) => void // Called on Cmd/Ctrl+click with JMESPath expression
}

interface PropertySchema {
  description?: string
  type?: string
  properties?: Record<string, PropertySchema>
  items?: PropertySchema
}

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

// Component for property key with popover tooltip
const PropertyKeyWithTooltip: React.FC<{
  keyName: string
  description?: string
  propType?: string
  validationError?: string
  onJmespathSelect?: (path: string) => void
  jmesPath: string
}> = ({ keyName, description, propType, validationError, onJmespathSelect, jmesPath }) => {
  const [open, setOpen] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && onJmespathSelect) {
      e.preventDefault()
      onJmespathSelect(jmesPath)
    }
  }

  const keyElement = (
    <span
      className={`${validationError ? 'text-red-400' : 'text-purple-400'} ${onJmespathSelect ? 'cursor-pointer' : ''}`}
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
            validationError
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
}> = ({ value, schema, validationErrors, path, jmesPath, indent, onJmespathSelect }) => {
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
}> = ({ value, schema, validationErrors, path, jmesPath, indent, onJmespathSelect }) => {
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
        const hasTooltip = description || validationError

        const plainKey = (
          <span
            className={`${validationError ? 'text-red-400' : 'text-purple-400'} ${onJmespathSelect ? 'cursor-pointer' : ''}`}
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
                onJmespathSelect={onJmespathSelect}
                jmesPath={propJmesPath}
              />
            ) : (
              plainKey
            )}
            {': '}
            {renderJsonNode(val, propSchema, validationErrors, propPath, propJmesPath, nextIndent, onJmespathSelect)}
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
    return <span className={`text-green-400 ${clickProps.className ?? ''}`} onClick={clickProps.onClick} title={clickProps.title}>"{value}"</span>
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
      />
    )
  }

  return <span>{String(value)}</span>
}

export const JsonResponseViewer: React.FC<JsonResponseViewerProps> = ({
  jsonString,
  responseSchema,
  validationErrors,
  onJmespathSelect,
}) => {
  try {
    const parsed = JSON.parse(jsonString)
    return <>{renderJsonNode(parsed, responseSchema, validationErrors, [], '', 0, onJmespathSelect)}</>
  } catch {
    // If parsing fails, return the raw string
    return <>{jsonString}</>
  }
}
