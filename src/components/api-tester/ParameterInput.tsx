import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ParameterInputProps {
  name: string;
  schema: any; // OpenAPI schema object
  value: any;
  required: boolean;
  description?: string;
  onChange: (value: any) => void;
  defaultValue?: any;
  isValid?: boolean; // Validation state for error highlighting (red)
  isUnspecified?: boolean; // Warning state for unspecified parameters (orange)
  validationReason?: string; // Optional tooltip text for validation
}

/**
 * Type-aware input component that renders different UI elements based on OpenAPI schema type
 */
export function ParameterInput({
  name,
  schema,
  value,
  required,
  description,
  onChange,
  defaultValue,
  isValid = true,
  isUnspecified = false,
  validationReason,
}: ParameterInputProps) {
  const [arrayItems, setArrayItems] = useState<any[]>(
    Array.isArray(value) ? value : defaultValue && Array.isArray(defaultValue) ? defaultValue : []
  );

  // Sync arrayItems when value prop changes (e.g., when switching tabs)
  useEffect(() => {
    if (schema?.type === "array") {
      if (Array.isArray(value)) {
        setArrayItems(value);
      } else if (value === undefined && Array.isArray(defaultValue)) {
        setArrayItems(defaultValue);
      }
    }
  }, [value, defaultValue, schema?.type]);

  // Determine the type from schema
  const type = schema?.type || "string";
  const format = schema?.format;
  const enumValues = schema?.enum;

  // Check if value is using default
  // For enums, we don't auto-fill with defaultValue - user must explicitly select
  const isUsingDefault = value === undefined && defaultValue !== undefined;
  const displayValue = value !== undefined ? value : (enumValues ? undefined : defaultValue);

  // Handle different input types based on schema
  const renderInput = () => {
    // Boolean type - render switch
    if (type === "boolean") {
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={displayValue === true}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <span className="text-sm text-muted-foreground">
            {displayValue === true ? "true" : "false"}
          </span>
        </div>
      );
    }

    // Enum type - render select dropdown
    if (enumValues && Array.isArray(enumValues) && enumValues.length > 0) {
      return (
        <Select
          value={displayValue !== undefined ? String(displayValue) : undefined}
          onValueChange={(val) => {
            // Special value for clearing selection
            if (val === "__NONE__") {
              onChange(undefined);
              return;
            }
            // Convert to appropriate type
            if (type === "number" || type === "integer") {
              onChange(Number(val));
            } else {
              onChange(val);
            }
          }}
        >
          <SelectTrigger className={isUsingDefault ? "italic text-muted-foreground" : ""}>
            <SelectValue placeholder={`Select ${name}...`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NONE__">
              <span className="text-muted-foreground italic">(none)</span>
            </SelectItem>
            {enumValues.map((enumVal) => (
              <SelectItem key={String(enumVal)} value={String(enumVal)}>
                {String(enumVal)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Number or Integer type - render number input
    if (type === "number" || type === "integer") {
      return (
        <Input
          type="number"
          value={displayValue !== undefined ? displayValue : ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") {
              onChange(undefined);
            } else {
              onChange(type === "integer" ? parseInt(val, 10) : parseFloat(val));
            }
          }}
          placeholder={defaultValue !== undefined ? String(defaultValue) : ""}
          className={isUsingDefault ? "italic text-muted-foreground" : ""}
          step={type === "integer" ? 1 : "any"}
        />
      );
    }

    // File/Binary type - render file input
    if (format === "binary" || format === "byte") {
      return (
        <div className="space-y-2">
          <Input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              onChange(file);
            }}
          />
          {displayValue instanceof File && (
            <div className="text-sm text-muted-foreground">
              Selected: {displayValue.name} ({Math.round(displayValue.size / 1024)} KB)
            </div>
          )}
        </div>
      );
    }

    // Array type - render multiple inputs
    if (type === "array") {
      const itemSchema = schema?.items || { type: "string" };
      const itemType = itemSchema.type || "string";
      const itemEnum = itemSchema.enum;

      const getDefaultItemValue = () => {
        if (itemType === "boolean") return false;
        if (itemType === "number" || itemType === "integer") return 0;
        if (itemType === "object") return {};
        if (itemEnum && itemEnum.length > 0) return undefined; // Start with no selection for enums
        return "";
      };

      const handleAddItem = () => {
        const newItems = [...arrayItems, getDefaultItemValue()];
        setArrayItems(newItems);
        onChange(newItems);
      };

      const handleRemoveItem = (index: number) => {
        const newItems = arrayItems.filter((_, i) => i !== index);
        setArrayItems(newItems);
        onChange(newItems);
      };

      const handleUpdateItem = (index: number, val: any) => {
        const newItems = [...arrayItems];
        newItems[index] = val;
        setArrayItems(newItems);
        onChange(newItems);
      };

      // Render individual array item based on schema type
      const renderArrayItem = (item: any, index: number) => {
        // Boolean type - render switch
        if (itemType === "boolean") {
          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={item === true}
                onCheckedChange={(checked) => handleUpdateItem(index, checked)}
              />
              <span className="text-sm text-muted-foreground">
                {item === true ? "true" : "false"}
              </span>
            </div>
          );
        }

        // Enum type - render select
        if (itemEnum && Array.isArray(itemEnum) && itemEnum.length > 0) {
          return (
            <Select
              value={item !== undefined ? String(item) : undefined}
              onValueChange={(val) => {
                // Special value for clearing selection
                if (val === "__NONE__") {
                  handleUpdateItem(index, undefined);
                  return;
                }
                if (itemType === "number" || itemType === "integer") {
                  handleUpdateItem(index, Number(val));
                } else {
                  handleUpdateItem(index, val);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select item ${index + 1}...`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">
                  <span className="text-muted-foreground italic">(none)</span>
                </SelectItem>
                {itemEnum.map((enumVal) => (
                  <SelectItem key={String(enumVal)} value={String(enumVal)}>
                    {String(enumVal)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        // Number or Integer type
        if (itemType === "number" || itemType === "integer") {
          return (
            <Input
              type="number"
              value={item !== undefined ? item : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  handleUpdateItem(index, itemType === "integer" ? 0 : 0.0);
                } else {
                  handleUpdateItem(
                    index,
                    itemType === "integer" ? parseInt(val, 10) : parseFloat(val)
                  );
                }
              }}
              placeholder={`Item ${index + 1}`}
              step={itemType === "integer" ? 1 : "any"}
            />
          );
        }

        // Object type - render JSON textarea
        if (itemType === "object") {
          let jsonValue = "";
          try {
            jsonValue = item !== undefined ? JSON.stringify(item, null, 2) : "";
          } catch (e) {
            jsonValue = "";
          }

          return (
            <Textarea
              value={jsonValue}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleUpdateItem(index, parsed);
                } catch (err) {
                  // Allow invalid JSON while typing
                }
              }}
              placeholder={`{"key": "value"}`}
              className="font-mono text-sm"
              rows={3}
            />
          );
        }

        // Default: String type
        return (
          <Input
            type="text"
            value={item !== undefined ? item : ""}
            onChange={(e) => handleUpdateItem(index, e.target.value)}
            placeholder={`Item ${index + 1}`}
          />
        );
      };

      return (
        <div className="space-y-2">
          {arrayItems.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                {renderArrayItem(item, index)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveItem(index)}
                className="mt-0.5"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddItem}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      );
    }

    // Object type or complex schema - render JSON textarea
    if (type === "object" || schema?.allOf || schema?.anyOf || schema?.oneOf) {
      let jsonValue = "";
      try {
        jsonValue = displayValue !== undefined ? JSON.stringify(displayValue, null, 2) : "";
      } catch (e) {
        jsonValue = "";
      }

      return (
        <div className="space-y-2">
          <Textarea
            value={jsonValue}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch (err) {
                // Allow invalid JSON while typing
                // Could add validation feedback here
              }
            }}
            placeholder='{"key": "value"}'
            className={`font-mono text-sm ${isUsingDefault ? "italic text-muted-foreground" : ""}`}
            rows={5}
          />
          <div className="text-xs text-muted-foreground">
            Enter valid JSON object
          </div>
        </div>
      );
    }

    // Default: String type - render text input
    return (
      <Input
        type="text"
        value={displayValue !== undefined ? displayValue : ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={defaultValue !== undefined ? String(defaultValue) : ""}
        className={isUsingDefault ? "italic text-muted-foreground" : ""}
      />
    );
  };

  // Determine the styling based on validation state (matching ExpandableParameterRow)
  const getNameClassName = () => {
    if (isUnspecified) return 'text-orange-500';
    if (!isValid) return 'text-destructive';
    return 'text-foreground';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={`param-${name}`} className="flex items-center gap-1">
          <span className={`font-mono text-sm ${getNameClassName()}`}>{name}</span>
          {required && <span className="text-destructive">*</span>}
          {!required && (
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          )}
        </Label>

        {description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <div className="space-y-1">
                <p className="text-sm">{description}</p>
                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                  <div>Type: {type}</div>
                  {format && <div>Format: {format}</div>}
                  {defaultValue !== undefined && (
                    <div>Default: {JSON.stringify(defaultValue)}</div>
                  )}
                  {enumValues && (
                    <div>Options: {enumValues.join(", ")}</div>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div id={`param-${name}`}>{renderInput()}</div>

      {isUsingDefault && (
        <div className="text-xs text-muted-foreground italic">
          Using default value: {JSON.stringify(defaultValue)}
        </div>
      )}
    </div>
  );
}
