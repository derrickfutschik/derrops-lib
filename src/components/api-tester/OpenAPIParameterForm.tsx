import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ParameterInput } from "./ParameterInput";
import { Badge } from "@/components/ui/badge";

export interface OpenAPIFormValues {
  pathParams: Record<string, any>;
  queryParams: Record<string, any>;
  headerParams: Record<string, any>;
  bodyParams: Record<string, any>;
}

interface OpenAPIParameterFormProps {
  operation: any; // OpenAPI operation object
  values: OpenAPIFormValues;
  onChange: (values: OpenAPIFormValues) => void;
}

interface Parameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  schema?: any;
  description?: string;
}

/**
 * Form component that displays all parameters from an OpenAPI operation
 * grouped by type (path, query, header, body) with collapsible sections
 */
export function OpenAPIParameterForm({ operation, values, onChange }: OpenAPIParameterFormProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    path: true,
    query: true,
    header: false,
    body: true,
  });

  if (!operation) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No operation selected
      </div>
    );
  }

  // Extract parameters from operation
  const parameters: Parameter[] = operation.parameters || [];

  // Group parameters by location
  const pathParams = parameters.filter((p) => p.in === "path");
  const queryParams = parameters.filter((p) => p.in === "query");
  const headerParams = parameters.filter((p) => p.in === "header");

  // Extract body parameters from requestBody
  const bodyParams: any[] = [];
  if (operation.requestBody) {
    const content = operation.requestBody.content;
    // Check for application/json content type
    if (content && content["application/json"]) {
      const schema = content["application/json"].schema;
      if (schema && schema.properties) {
        // Convert properties to parameter-like objects
        Object.entries(schema.properties).forEach(([propName, propSchema]: [string, any]) => {
          bodyParams.push({
            name: propName,
            in: "body",
            required: schema.required?.includes(propName) || false,
            schema: propSchema,
            description: propSchema.description,
          });
        });
      }
    }
  }

  // Validate parameter value based on schema and required status
  const validateParam = (param: Parameter, value: any): { isValid: boolean; reason: string } => {
    const schema = param.schema || {};
    const type = schema.type || "string";

    // Required check
    if (param.required && (value === undefined || value === null || value === "")) {
      return { isValid: false, reason: "Required parameter is missing" };
    }

    // If no value provided and not required, it's valid
    if (value === undefined || value === null || value === "") {
      return { isValid: true, reason: "" };
    }

    // Type validation
    const valueStr = String(value);

    if (type === "integer") {
      const isInteger = /^-?\d+$/.test(valueStr);
      if (!isInteger) {
        return { isValid: false, reason: "Must be an integer" };
      }
    } else if (type === "number") {
      const isNumber = !isNaN(Number(valueStr));
      if (!isNumber) {
        return { isValid: false, reason: "Must be a number" };
      }
    } else if (type === "boolean") {
      const isBoolean = valueStr === "true" || valueStr === "false" || typeof value === "boolean";
      if (!isBoolean) {
        return { isValid: false, reason: "Must be true or false" };
      }
    }

    return { isValid: true, reason: "" };
  };

  // Sort parameters: required first, then optional, then alphabetically
  const sortParams = (params: Parameter[]) => {
    return [...params].sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const sortedPathParams = sortParams(pathParams);
  const sortedQueryParams = sortParams(queryParams);
  const sortedHeaderParams = sortParams(headerParams);
  const sortedBodyParams = sortParams(bodyParams);

  // Handle parameter change
  const handleParamChange = (
    location: "pathParams" | "queryParams" | "headerParams" | "bodyParams",
    paramName: string,
    value: any
  ) => {
    onChange({
      ...values,
      [location]: {
        ...values[location],
        [paramName]: value,
      },
    });
  };

  // Render a section of parameters
  const renderSection = (
    title: string,
    sectionKey: string,
    params: Parameter[],
    location: "pathParams" | "queryParams" | "headerParams" | "bodyParams"
  ) => {
    if (params.length === 0) return null;

    const requiredCount = params.filter((p) => p.required).length;
    const isOpen = openSections[sectionKey];

    return (
      <Collapsible
        open={isOpen}
        onOpenChange={(open) =>
          setOpenSections({ ...openSections, [sectionKey]: open })
        }
        className="border border-border rounded-lg"
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors rounded-t-lg">
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium text-sm">{title}</span>
            <Badge variant="secondary" className="text-xs">
              {params.length}
            </Badge>
            {requiredCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {requiredCount} required
              </Badge>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-4 py-3 space-y-4">
          {params.map((param) => {
            const paramValue = values[location][param.name];
            const validation = validateParam(param, paramValue);

            return (
              <ParameterInput
                key={param.name}
                name={param.name}
                schema={param.schema || {}}
                value={paramValue}
                required={param.required || false}
                description={param.description}
                onChange={(value) => handleParamChange(location, param.name, value)}
                defaultValue={param.schema?.default}
                isValid={validation.isValid}
                validationReason={validation.reason}
              />
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Check if there are any parameters at all
  const hasAnyParams =
    sortedPathParams.length > 0 ||
    sortedQueryParams.length > 0 ||
    sortedHeaderParams.length > 0 ||
    sortedBodyParams.length > 0;

  if (!hasAnyParams) {
    return (
      <div className="text-center text-muted-foreground py-8 border border-border rounded-lg bg-muted/10">
        <p className="text-sm">This operation has no parameters</p>
        <p className="text-xs mt-1">You can send the request directly</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderSection("Path Parameters", "path", sortedPathParams, "pathParams")}
      {renderSection("Query Parameters", "query", sortedQueryParams, "queryParams")}
      {renderSection("Headers", "header", sortedHeaderParams, "headerParams")}
      {renderSection("Body Parameters", "body", sortedBodyParams, "bodyParams")}
    </div>
  );
}
