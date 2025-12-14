import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface JsonResponseViewerProps {
  jsonString: string;
  responseSchema: any;
}

interface PropertySchema {
  description?: string;
  type?: string;
  properties?: Record<string, PropertySchema>;
  items?: PropertySchema;
}

// Recursively get property schema from a path
const getPropertySchema = (schema: PropertySchema | undefined, path: string[]): PropertySchema | undefined => {
  if (!schema || path.length === 0) return schema;
  
  const [current, ...rest] = path;
  
  // Handle array items
  if (schema.type === 'array' && schema.items) {
    return getPropertySchema(schema.items, path);
  }
  
  // Handle object properties
  if (schema.properties && schema.properties[current]) {
    if (rest.length === 0) {
      return schema.properties[current];
    }
    return getPropertySchema(schema.properties[current], rest);
  }
  
  return undefined;
};

// Parse JSON and render with tooltips
const renderJsonWithTooltips = (
  value: any,
  schema: PropertySchema | undefined,
  path: string[] = [],
  indent: number = 0
): React.ReactNode => {
  const indentStr = "  ".repeat(indent);
  const nextIndent = indent + 1;
  const nextIndentStr = "  ".repeat(nextIndent);

  if (value === null) {
    return <span className="text-red-400">null</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-blue-400">{value.toString()}</span>;
  }

  if (typeof value === "number") {
    return <span className="text-amber-400">{value}</span>;
  }

  if (typeof value === "string") {
    return <span className="text-green-400">"{value}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span>[]</span>;
    }

    const itemSchema = schema?.items;
    
    return (
      <>
        {"[\n"}
        {value.map((item, index) => (
          <React.Fragment key={index}>
            {nextIndentStr}
            {renderJsonWithTooltips(item, itemSchema, [...path, String(index)], nextIndent)}
            {index < value.length - 1 ? ",\n" : "\n"}
          </React.Fragment>
        ))}
        {indentStr}]
      </>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span>{"{}"}</span>;
    }

    return (
      <>
        {"{\n"}
        {entries.map(([key, val], index) => {
          const propPath = [...path, key];
          const propSchema = getPropertySchema(schema, [key]);
          const description = propSchema?.description;
          const propType = propSchema?.type;

          const keyElement = (
            <span className="text-purple-400">"{key}"</span>
          );

          return (
            <React.Fragment key={key}>
              {nextIndentStr}
              {description ? (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span className="cursor-help border-b border-dashed border-purple-400/50 hover:border-purple-400">
                      {keyElement}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    className="max-w-[300px] text-sm"
                  >
                    <div className="space-y-1">
                      {propType && (
                        <div className="text-xs text-muted-foreground font-mono">
                          Type: {propType}
                        </div>
                      )}
                      <div>{description}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                keyElement
              )}
              {": "}
              {renderJsonWithTooltips(val, propSchema, propPath, nextIndent)}
              {index < entries.length - 1 ? ",\n" : "\n"}
            </React.Fragment>
          );
        })}
        {indentStr}{"}"}
      </>
    );
  }

  return <span>{String(value)}</span>;
};

export const JsonResponseViewer: React.FC<JsonResponseViewerProps> = ({ 
  jsonString, 
  responseSchema 
}) => {
  try {
    const parsed = JSON.parse(jsonString);
    return <>{renderJsonWithTooltips(parsed, responseSchema)}</>;
  } catch {
    // If parsing fails, return the raw string
    return <>{jsonString}</>;
  }
};
