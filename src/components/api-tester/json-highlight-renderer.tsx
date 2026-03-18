import React from 'react'

/**
 * Render a parsed JSON value as React nodes with JMESPath highlight styling.
 *
 * Nodes that appear in `matchedPaths` are rendered with primary/bold styling;
 * all others are dimmed. Cmd/Ctrl+clicking any node calls `onClickPath` so the
 * caller can use the path as a new JMESPath expression.
 */
export function highlightJson(
  parsed: any,
  matchedPaths: Set<string>,
  onClickPath: (path: string) => void,
): React.ReactNode {
  const handleClick = (path: string) => (e: React.MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && path) {
      e.preventDefault()
      onClickPath(path)
    }
  }

  const renderValue = (value: any, currentPath: string, indent: number = 0): React.ReactNode => {
    const indentStr = '  '.repeat(indent)
    const isHighlighted = matchedPaths.has(currentPath)
    const className = isHighlighted ? 'text-primary font-semibold' : 'text-muted-foreground/50'
    const clickTitle = 'Cmd/Ctrl+click to use as JMESPath'

    if (value === null) {
      return <span className={`${className} cursor-pointer`} onClick={handleClick(currentPath)} title={clickTitle}>null</span>
    }
    if (typeof value === 'boolean') {
      return <span className={`${className} cursor-pointer`} onClick={handleClick(currentPath)} title={clickTitle}>{String(value)}</span>
    }
    if (typeof value === 'number') {
      return <span className={`${className} cursor-pointer`} onClick={handleClick(currentPath)} title={clickTitle}>{value}</span>
    }
    if (typeof value === 'string') {
      return <span className={`${className} cursor-pointer`} onClick={handleClick(currentPath)} title={clickTitle}>"{value}"</span>
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-muted-foreground/50">[]</span>
      return (
        <>
          <span className="text-muted-foreground/50">[</span>
          {'\n'}
          {value.map((item, idx) => {
            const itemPath = currentPath ? `${currentPath}[${idx}]` : `[${idx}]`
            return (
              <React.Fragment key={idx}>
                {indentStr}
                {'  '}
                {renderValue(item, itemPath, indent + 1)}
                {idx < value.length - 1 && <span className="text-muted-foreground/50">,</span>}
                {'\n'}
              </React.Fragment>
            )
          })}
          {indentStr}
          <span className="text-muted-foreground/50">]</span>
        </>
      )
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value)
      if (keys.length === 0) return <span className="text-muted-foreground/50">{'{}'}</span>
      return (
        <>
          <span className="text-muted-foreground/50">{'{'}</span>
          {'\n'}
          {keys.map((key, idx) => {
            const keyPath = currentPath ? `${currentPath}.${key}` : key
            return (
              <React.Fragment key={key}>
                {indentStr}
                {'  '}
                <span className="text-muted-foreground/50 cursor-pointer" onClick={handleClick(keyPath)} title={clickTitle}>"{key}"</span>
                <span className="text-muted-foreground/50">: </span>
                {renderValue(value[key], keyPath, indent + 1)}
                {idx < keys.length - 1 && <span className="text-muted-foreground/50">,</span>}
                {'\n'}
              </React.Fragment>
            )
          })}
          {indentStr}
          <span className="text-muted-foreground/50">{'}'}</span>
        </>
      )
    }

    return String(value)
  }

  return renderValue(parsed, '', 0)
}
