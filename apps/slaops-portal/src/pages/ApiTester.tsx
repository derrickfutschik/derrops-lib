import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Send, Plus, Trash2, AlertCircle, CheckCircle, Server, Route, FileCode, Minus, Lock, Unlock, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { toast } from "sonner";
import yaml from "js-yaml";
import { ExpandableParameterRow } from "@/components/api-tester/ExpandableParameterRow";
import { RequestBodyEditor, BodyType, RawType, FormDataEntry } from "@/components/api-tester/RequestBodyEditor";
import { JsonResponseViewer } from "@/components/api-tester/JsonResponseViewer";
import { OpenAPIRequestTab } from "@/components/api-tester/OpenAPIRequestTab";
import { OpenAPIFormValues } from "@/components/api-tester/OpenAPIParameterForm";

interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

interface Service {
  id: string;
  name: string;
  endpoint: string | null;
  openapi_doc_url: string | null;
  openapi_doc_content: string | null;
}

interface ParameterInfo {
  name: string;
  type: string;
  required: boolean;
  value: string | null;
  defaultValue?: string | null;
  isUsingDefault: boolean;
  isUnspecified: boolean;
  isValid: boolean;
  validationReason: string;
  description?: string;
  rawJson: object;
}

interface ServerVariable {
  name: string;
  value: string;
  default: string;
  description?: string;
  enum?: string[];
}

interface ServerInfo {
  index: number;
  url: string;
  resolvedUrl: string;
  description?: string;
  variables: ServerVariable[];
}

interface BodyPropertyInfo {
  name: string;
  type: string;
  required: boolean;
  value: any;
  isValid: boolean;
  validationReason: string;
  description?: string;
  rawJson: object;
}

interface MatchResult {
  matched: boolean;
  service: Service | null;
  server: ServerInfo | null;
  operation: {
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    description?: string;
    pathParameters: ParameterInfo[];
    queryParameters: ParameterInfo[];
    headerParameters: ParameterInfo[];
    bodyProperties: BodyPropertyInfo[];
    bodyContentType?: string;
    responseSchema?: any;
  } | null;
  validationErrors: string[];
  validationWarnings: string[];
  spec: any;
}

interface OperationOption {
  key: string; // "method:path" e.g. "GET:/users/{id}"
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/**
 * Extract validation errors from match result to display in response JSON tooltips
 */
const extractValidationErrors = (matchResult: MatchResult | null): Record<string, string> => {
  if (!matchResult?.operation) return {};

  const errors: Record<string, string> = {};

  // Collect errors from all parameter types
  const allParameters = [
    ...(matchResult.operation.pathParameters || []),
    ...(matchResult.operation.queryParameters || []),
    ...(matchResult.operation.headerParameters || []),
    ...(matchResult.operation.bodyProperties || []),
  ];

  // Map parameter names to their validation errors
  allParameters.forEach((param) => {
    if (!param.isValid && param.validationReason) {
      errors[param.name] = param.validationReason;
    }
  });

  return errors;
};

/**
 * Extract response schema from OpenAPI spec based on HTTP status code
 * Looks for exact status code match first, then falls back to default or 2xx pattern
 */
const getResponseSchemaForStatus = (matchResult: MatchResult | null, statusCode: number): any => {
  if (!matchResult?.operation || !matchResult?.spec) return undefined;

  const { spec, operation } = matchResult;
  const { paths } = spec;

  if (!paths || !paths[operation.path]) return undefined;

  const pathMethods = paths[operation.path];
  const lowerMethod = operation.method.toLowerCase();
  const operationDef = pathMethods[lowerMethod];

  if (!operationDef?.responses) return undefined;

  // Try to find response schema in this order:
  // 1. Exact status code match (e.g., "400", "404")
  // 2. Pattern match (e.g., "4XX", "2XX")
  // 3. Default response
  const statusString = String(statusCode);
  const statusPattern = `${statusString[0]}XX`;

  const responseToCheck =
    operationDef.responses[statusString] ||
    operationDef.responses[statusPattern] ||
    operationDef.responses['default'];

  if (!responseToCheck?.content) return undefined;

  // Look for JSON content type
  const jsonContent = Object.keys(responseToCheck.content).find(ct => ct.includes('json'));

  if (jsonContent && responseToCheck.content[jsonContent]?.schema) {
    return responseToCheck.content[jsonContent].schema;
  }

  return undefined;
};

const ApiTester = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [headers, setHeaders] = useState<KeyValuePair[]>([
    { key: "Content-Type", value: "application/json", enabled: true },
  ]);
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([
    { key: "", value: "", enabled: true },
  ]);
  const [body, setBody] = useState("");
  const [bodyType, setBodyType] = useState<BodyType>("raw");
  const [rawType, setRawType] = useState<RawType>("json");
  const [formData, setFormData] = useState<FormDataEntry[]>([
    { key: "", value: "", enabled: true },
  ]);
  const [services, setServices] = useState<Service[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  
  // Action mode: "analyze" or "request"
  type ActionMode = "analyze" | "request";
  const [actionMode, setActionMode] = useState<ActionMode>("analyze");
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [requestResponse, setRequestResponse] = useState<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  } | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"match" | "response">("match");
  
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    service: false,
    server: false,
    operation: false,
    pathParams: false,
    queryParams: false,
    headerParams: false,
    bodyParams: false,
    validation: false,
  });
  
  // Manual selection state
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedOperationKey, setSelectedOperationKey] = useState<string | null>(null);
  const [availableOperations, setAvailableOperations] = useState<OperationOption[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [parsedSpecs, setParsedSpecs] = useState<Record<string, any>>({});

  // OpenAPI tab state
  const [openAPIServiceId, setOpenAPIServiceId] = useState<string | null>(null);
  const [openAPIOperationKey, setOpenAPIOperationKey] = useState<string | null>(null);
  const [openAPIOperation, setOpenAPIOperation] = useState<any>(null);
  const [openAPIFormValues, setOpenAPIFormValues] = useState<OpenAPIFormValues>({
    pathParams: {},
    queryParams: {},
    headerParams: {},
    bodyParams: {},
  });
  // Ref to track the last synced form values to prevent infinite loops
  const lastSyncedFormValuesRef = useRef<OpenAPIFormValues>(openAPIFormValues);
  // Ref to prevent bidirectional sync loops (acts as a lock)
  const isSyncingRef = useRef<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("params");
  
  // Sorting state for parameter tables
  type SortColumn = 'name' | 'type' | 'required' | 'value' | 'isValid';
  type SortDirection = 'asc' | 'desc';
  const [pathParamSort, setPathParamSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: 'name', direction: 'asc' });
  const [queryParamSort, setQueryParamSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: 'name', direction: 'asc' });
  const [headerParamSort, setHeaderParamSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: 'name', direction: 'asc' });
  const [bodyParamSort, setBodyParamSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: 'name', direction: 'asc' });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Check if a query param key is duplicated
  const isQueryParamDuplicate = (index: number, key: string): boolean => {
    if (!key.trim()) return false;
    const lowerKey = key.toLowerCase();
    return queryParams.some((p, i) => i !== index && p.enabled && p.key.toLowerCase() === lowerKey);
  };

  // Check if a header key is duplicated
  const isHeaderDuplicate = (index: number, key: string): boolean => {
    if (!key.trim()) return false;
    const lowerKey = key.toLowerCase();
    return headers.some((h, i) => i !== index && h.enabled && h.key.toLowerCase() === lowerKey);
  };

  // Get validation status for a query param from matchResult
  const getQueryParamValidationStatus = (paramKey: string): { isValid: boolean; isUnspecified: boolean } | null => {
    if (!matchResult?.operation || !paramKey.trim()) return null;
    const param = matchResult.operation.queryParameters.find(
      p => p.name.toLowerCase() === paramKey.toLowerCase()
    );
    if (param) {
      return { isValid: param.isValid, isUnspecified: param.isUnspecified };
    }
    return null;
  };

  // Get validation status for a header from matchResult
  const getHeaderValidationStatus = (headerKey: string): { isValid: boolean; isUnspecified: boolean } | null => {
    if (!matchResult?.operation || !headerKey.trim()) return null;
    const param = matchResult.operation.headerParameters.find(
      p => p.name.toLowerCase() === headerKey.toLowerCase()
    );
    if (param) {
      return { isValid: param.isValid, isUnspecified: param.isUnspecified };
    }
    return null;
  };

  // Get input border class based on validation status and duplicate detection
  const getValidationBorderClass = (status: { isValid: boolean; isUnspecified: boolean } | null, isDuplicate: boolean): string => {
    if (isDuplicate) return "border-destructive focus-visible:ring-destructive";
    if (!status) return "";
    if (!status.isValid) return "border-destructive focus-visible:ring-destructive";
    if (status.isUnspecified) return "border-orange-500 focus-visible:ring-orange-500";
    return "border-green-500 focus-visible:ring-green-500";
  };

  const sortParameters = (params: ParameterInfo[], sortConfig: { column: SortColumn; direction: SortDirection }): ParameterInfo[] => {
    return [...params].sort((a, b) => {
      let comparison = 0;
      switch (sortConfig.column) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'required':
          comparison = (a.required === b.required) ? 0 : a.required ? -1 : 1;
          break;
        case 'value':
          comparison = (a.value || '').localeCompare(b.value || '');
          break;
        case 'isValid':
          // Sort order: Valid (0) < Warning/Unspecified (1) < Invalid (2)
          const getValidityScore = (p: ParameterInfo) => {
            if (!p.isValid) return 2; // Invalid
            if (p.isUnspecified) return 1; // Warning
            return 0; // Valid
          };
          comparison = getValidityScore(a) - getValidityScore(b);
          break;
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  const handleSort = (
    column: SortColumn,
    currentSort: { column: SortColumn; direction: SortDirection },
    setSort: React.Dispatch<React.SetStateAction<{ column: SortColumn; direction: SortDirection }>>
  ) => {
    if (currentSort.column === column) {
      setSort({ column, direction: currentSort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ column, direction: 'asc' });
    }
  };

  const SortableHeader = ({ 
    column, 
    label, 
    currentSort, 
    onSort 
  }: { 
    column: SortColumn; 
    label: string; 
    currentSort: { column: SortColumn; direction: SortDirection }; 
    onSort: (column: SortColumn) => void;
  }) => (
    <th 
      className="text-left px-3 py-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {currentSort.column === column ? (
          currentSort.direction === 'asc' ? 
            <ArrowUp className="h-3 w-3" /> : 
            <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </div>
    </th>
  );

  useEffect(() => {
    fetchServices();
  }, []);

  // Extract operations when service is selected
  useEffect(() => {
    const loadOperations = async () => {
      if (!selectedServiceId) {
        setAvailableOperations([]);
        setSelectedOperationKey(null);
        return;
      }

      const service = services.find(s => s.id === selectedServiceId);
      if (!service) return;

      // Check if spec is already parsed
      if (parsedSpecs[selectedServiceId]) {
        extractOperationsFromSpec(parsedSpecs[selectedServiceId]);
        return;
      }

      const spec = await parseOpenApiSpec(service);
      if (spec) {
        setParsedSpecs(prev => ({ ...prev, [selectedServiceId]: spec }));
        extractOperationsFromSpec(spec);
      }
    };

    loadOperations();
  }, [selectedServiceId, services]);

  const extractOperationsFromSpec = (spec: any) => {
    const operations: OperationOption[] = [];
    
    if (spec.paths) {
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        const methods = pathItem as Record<string, any>;
        for (const method of HTTP_METHODS) {
          const lowerMethod = method.toLowerCase();
          if (methods[lowerMethod]) {
            operations.push({
              key: `${method}:${path}`,
              method: method,
              path: path,
              operationId: methods[lowerMethod].operationId,
              summary: methods[lowerMethod].summary,
            });
          }
        }
      }
    }
    
    setAvailableOperations(operations);
  };

  // Sync query params to URL
  useEffect(() => {
    if (!url) return;
    
    try {
      const urlObj = new URL(url);
      const enabledParams = queryParams.filter(p => p.enabled && p.key.trim());
      
      // Clear existing params and add from state
      urlObj.search = "";
      enabledParams.forEach(p => {
        urlObj.searchParams.append(p.key, p.value);
      });
      
      const newUrl = urlObj.toString();
      if (newUrl !== url) {
        setUrl(newUrl);
      }
    } catch {
      // Invalid URL, ignore
    }
  }, [queryParams]);

  // Parse URL query params when URL changes manually
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);

    try {
      const urlObj = new URL(newUrl);
      const params: KeyValuePair[] = [];
      urlObj.searchParams.forEach((value, key) => {
        params.push({ key, value, enabled: true });
      });
      // Always add an empty row at the end for new entries
      params.push({ key: "", value: "", enabled: true });
      setQueryParams(params);
    } catch {
      // Invalid URL, ignore - keep existing params
    }
  };

  // Helper: Reconstruct URL from OpenAPI operation + path params
  const reconstructUrlFromOperation = (operation: any, pathParams: Record<string, any>): string => {
    if (!operation || !operation.path) return "";

    let path = operation.path;

    // Replace path parameters with actual values
    Object.entries(pathParams).forEach(([paramName, paramValue]) => {
      path = path.replace(`{${paramName}}`, String(paramValue || ""));
    });

    // Get the first service to construct base URL
    // In a real scenario, you might want to use the server URL from the spec
    const service = services.find(s => s.id === openAPIServiceId);
    if (service?.endpoint) {
      return `${service.endpoint}${path}`;
    }

    // Fallback: just return the path
    return path.startsWith("http") ? path : `https://api.example.com${path}`;
  };

  // Helper: Parse value by type
  const parseValueByType = (value: string, schema: any): any => {
    if (!schema) return value;

    const type = schema.type;

    if (type === "boolean") {
      return value === "true" || value === "1";
    }

    if (type === "number") {
      const num = parseFloat(value);
      return isNaN(num) ? value : num;
    }

    if (type === "integer") {
      const num = parseInt(value, 10);
      return isNaN(num) ? value : num;
    }

    if (type === "array" || type === "object") {
      // Try to parse as JSON
      try {
        return JSON.parse(value);
      } catch {
        // If parsing fails, return as-is
        return value;
      }
    }

    return value;
  };

  // Helper: Extract path params from URL using operation path template
  const extractPathParamsFromUrl = (url: string, pathTemplate: string): Record<string, string> => {
    const pathParams: Record<string, string> = {};

    try {
      const urlObj = new URL(url);
      const urlPath = urlObj.pathname;

      // Convert path template to regex
      // e.g., "/users/{id}/posts/{postId}" -> "/users/([^/]+)/posts/([^/]+)"
      const paramNames: string[] = [];
      const regexPattern = pathTemplate.replace(/\{([^}]+)\}/g, (_, paramName) => {
        paramNames.push(paramName);
        return "([^/]+)";
      });

      const regex = new RegExp(`^${regexPattern}$`);
      const match = urlPath.match(regex);

      if (match) {
        paramNames.forEach((paramName, index) => {
          pathParams[paramName] = match[index + 1];
        });
      }
    } catch {
      // Invalid URL or template
    }

    return pathParams;
  };

  // Sync: OpenAPI form → Other tabs
  useEffect(() => {
    if (activeTab !== "openapi" || !openAPIOperation) return;

    // Skip if we're already syncing (prevents bidirectional loop)
    if (isSyncingRef.current) return;

    // Set the sync lock
    isSyncingRef.current = true;

    // Update the ref to track what we're syncing
    lastSyncedFormValuesRef.current = openAPIFormValues;

    // Update URL and method
    const reconstructedUrl = reconstructUrlFromOperation(openAPIOperation, openAPIFormValues.pathParams);
    setUrl(reconstructedUrl);
    setMethod(openAPIOperation.method);

    // Update query params
    const newQueryParams: KeyValuePair[] = Object.entries(openAPIFormValues.queryParams)
      .filter(([_, value]) => {
        // Keep arrays and objects even if empty, but filter out undefined, null, and empty strings
        if (Array.isArray(value) || (typeof value === "object" && value !== null)) return true;
        return value !== undefined && value !== null && value !== "";
      })
      .map(([key, value]) => ({
        key,
        // Serialize arrays and objects as JSON, otherwise convert to string
        value: Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : String(value),
        enabled: true,
      }));
    // Add empty row
    newQueryParams.push({ key: "", value: "", enabled: true });
    setQueryParams(newQueryParams);

    // Update headers
    const newHeaders: KeyValuePair[] = Object.entries(openAPIFormValues.headerParams)
      .filter(([_, value]) => {
        // Keep arrays and objects even if empty, but filter out undefined, null, and empty strings
        if (Array.isArray(value) || (typeof value === "object" && value !== null)) return true;
        return value !== undefined && value !== null && value !== "";
      })
      .map(([key, value]) => ({
        key,
        // Serialize arrays and objects as JSON, otherwise convert to string
        value: Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : String(value),
        enabled: true,
      }));
    // Add Content-Type if not present and ensure at least one empty row
    if (!newHeaders.some(h => h.key.toLowerCase() === "content-type")) {
      newHeaders.push({ key: "Content-Type", value: "application/json", enabled: true });
    }
    setHeaders(newHeaders);

    // Update body
    if (Object.keys(openAPIFormValues.bodyParams).length > 0) {
      setBody(JSON.stringify(openAPIFormValues.bodyParams, null, 2));
      setBodyType("raw");
      setRawType("json");
    }

    // Clear the sync lock after a microtask to allow state updates to propagate
    Promise.resolve().then(() => {
      isSyncingRef.current = false;
    });
  }, [openAPIFormValues, activeTab, openAPIOperation]);

  // Sync: Other tabs → OpenAPI form (when switching TO openapi tab OR when params change)
  useEffect(() => {
    if (activeTab !== "openapi" || !openAPIOperation) return;

    // Skip if we're already syncing (prevents bidirectional loop)
    if (isSyncingRef.current) return;

    const operation = openAPIOperation;
    const parameters = operation.parameters || [];

    // Sync query params
    const syncedQueryParams: Record<string, any> = {};
    const opQueryParams = parameters.filter((p: any) => p.in === "query");
    opQueryParams.forEach((param: any) => {
      const existing = queryParams.find(p => p.key === param.name && p.enabled);
      if (existing && existing.value) {
        syncedQueryParams[param.name] = parseValueByType(existing.value, param.schema);
      }
    });

    // Sync headers
    const syncedHeaderParams: Record<string, any> = {};
    const opHeaderParams = parameters.filter((p: any) => p.in === "header");
    opHeaderParams.forEach((param: any) => {
      const existing = headers.find(h => h.key.toLowerCase() === param.name.toLowerCase() && h.enabled);
      if (existing && existing.value) {
        syncedHeaderParams[param.name] = parseValueByType(existing.value, param.schema);
      }
    });

    // Sync path params (extract from URL)
    const syncedPathParams: Record<string, any> = {};
    const opPathParams = parameters.filter((p: any) => p.in === "path");
    if (url && operation.path) {
      const extractedParams = extractPathParamsFromUrl(url, operation.path);
      opPathParams.forEach((param: any) => {
        if (extractedParams[param.name]) {
          syncedPathParams[param.name] = parseValueByType(extractedParams[param.name], param.schema);
        }
      });
    }

    // Sync body params (parse JSON if available)
    let syncedBodyParams: Record<string, any> = {};
    if (bodyType === "raw" && rawType === "json" && body) {
      try {
        syncedBodyParams = JSON.parse(body);
      } catch {
        // Invalid JSON, ignore
      }
    }

    // Helper to normalize objects for comparison (sort keys alphabetically)
    const normalizeForComparison = (obj: Record<string, any>): string => {
      const sortedKeys = Object.keys(obj).sort();
      const normalized: Record<string, any> = {};
      sortedKeys.forEach(key => {
        normalized[key] = obj[key];
      });
      return JSON.stringify(normalized);
    };

    // Compare against the last synced values (stored in ref) instead of current openAPIFormValues
    // This prevents infinite loops while still allowing proper synchronization
    const lastSynced = lastSyncedFormValuesRef.current;
    const isQueryParamsDifferent = normalizeForComparison(syncedQueryParams) !== normalizeForComparison(lastSynced.queryParams);
    const isHeaderParamsDifferent = normalizeForComparison(syncedHeaderParams) !== normalizeForComparison(lastSynced.headerParams);
    const isPathParamsDifferent = normalizeForComparison(syncedPathParams) !== normalizeForComparison(lastSynced.pathParams);
    const isBodyParamsDifferent = normalizeForComparison(syncedBodyParams) !== normalizeForComparison(lastSynced.bodyParams);

    // Only update if there are actual changes compared to last synced values
    if (isQueryParamsDifferent || isHeaderParamsDifferent || isPathParamsDifferent || isBodyParamsDifferent) {
      // Set the sync lock
      isSyncingRef.current = true;

      const newFormValues = {
        pathParams: syncedPathParams,
        queryParams: syncedQueryParams,
        headerParams: syncedHeaderParams,
        bodyParams: syncedBodyParams,
      };
      // Update both the state and the ref
      lastSyncedFormValuesRef.current = newFormValues;
      setOpenAPIFormValues(newFormValues);

      // Clear the sync lock after a microtask to allow state updates to propagate
      Promise.resolve().then(() => {
        isSyncingRef.current = false;
      });
    }
  }, [activeTab, queryParams, headers, url, body, bodyType, rawType, openAPIOperation]); // Removed openAPIFormValues to prevent circular dependency

  const fetchServices = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("services")
      .select("id, name, endpoint, openapi_doc_url, openapi_doc_content");

    if (error) {
      toast.error("Failed to fetch services");
      return;
    }

    setServices(data || []);
  };

  const addHeader = () => {
    setHeaders([...headers, { key: "", value: "", enabled: true }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const updated = [...headers];
    updated[index] = { ...updated[index], [field]: value };
    setHeaders(updated);
  };

  const addQueryParam = () => {
    setQueryParams([...queryParams, { key: "", value: "", enabled: true }]);
  };

  const removeQueryParam = (index: number) => {
    setQueryParams(queryParams.filter((_, i) => i !== index));
  };

  const updateQueryParam = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const updated = [...queryParams];
    updated[index] = { ...updated[index], [field]: value };
    setQueryParams(updated);
  };

  const parseOpenApiSpec = async (service: Service): Promise<any> => {
    let specContent = service.openapi_doc_content;

    if (!specContent && service.openapi_doc_url) {
      try {
        const response = await fetch(service.openapi_doc_url);
        specContent = await response.text();
      } catch {
        return null;
      }
    }

    if (!specContent) return null;

    try {
      // Try YAML first
      return yaml.load(specContent);
    } catch {
      try {
        return JSON.parse(specContent);
      } catch {
        return null;
      }
    }
  };

  const matchUrlToPath = (requestUrl: string, basePath: string, pathTemplate: string): boolean => {
    try {
      const url = new URL(requestUrl);
      const requestPath = url.pathname;
      
      // Remove basePath from request path if present
      let normalizedRequestPath = requestPath;
      if (basePath && requestPath.startsWith(basePath)) {
        normalizedRequestPath = requestPath.slice(basePath.length) || "/";
      }

      // Convert OpenAPI path template to regex
      const pathRegex = new RegExp(
        "^" + pathTemplate.replace(/\{[^}]+\}/g, "[^/]+") + "$"
      );

      return pathRegex.test(normalizedRequestPath);
    } catch {
      return false;
    }
  };

  const validateRequest = (spec: any, operation: any, requestBody: string, requestHeaders: KeyValuePair[], requestQueryParams: KeyValuePair[]): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if body is required
    if (operation.requestBody?.required && !requestBody.trim()) {
      errors.push("Request body is required but not provided");
    }

    // Validate JSON body if Content-Type is application/json
    const contentTypeHeader = requestHeaders.find(
      (h) => h.enabled && h.key.toLowerCase() === "content-type"
    );
    if (contentTypeHeader?.value.includes("application/json") && requestBody.trim()) {
      try {
        JSON.parse(requestBody);
      } catch {
        errors.push("Request body is not valid JSON");
      }
    }

    // Get spec parameter names
    const specQueryParams = (operation.parameters || [])
      .filter((p: any) => p.in === "query")
      .map((p: any) => p.name.toLowerCase());
    
    const specHeaderParams = (operation.parameters || [])
      .filter((p: any) => p.in === "header")
      .map((p: any) => p.name.toLowerCase());

    // Common headers to ignore
    const commonHeaders = ['content-type', 'accept', 'authorization', 'user-agent', 'host', 'connection', 'cache-control'];

    // Check for unspecified query parameters
    const unspecifiedQueryParams = requestQueryParams
      .filter(p => p.enabled && p.key.trim() && !specQueryParams.includes(p.key.toLowerCase()));
    
    for (const param of unspecifiedQueryParams) {
      warnings.push(`Query parameter "${param.key}" is not defined in the OpenAPI specification`);
    }

    // Check for unspecified header parameters
    const unspecifiedHeaders = requestHeaders
      .filter(h => h.enabled && h.key.trim() && 
        !specHeaderParams.includes(h.key.toLowerCase()) &&
        !commonHeaders.includes(h.key.toLowerCase()));
    
    for (const header of unspecifiedHeaders) {
      warnings.push(`Header "${header.key}" is not defined in the OpenAPI specification`);
    }

    // Check required parameters
    if (operation.parameters) {
      const requiredParams = operation.parameters.filter((p: any) => p.required);
      for (const param of requiredParams) {
        if (param.in === "header") {
          const found = requestHeaders.find(
            (h) => h.enabled && h.key.toLowerCase() === param.name.toLowerCase()
          );
          if (!found || !found.value) {
            errors.push(`Required header "${param.name}" is missing`);
          }
        }
        if (param.in === "query") {
          const found = requestQueryParams.find(
            (p) => p.enabled && p.key.toLowerCase() === param.name.toLowerCase()
          );
          if (!found || !found.value) {
            errors.push(`Required query parameter "${param.name}" is missing`);
          }
        }
      }
    }

    return { errors, warnings };
  };

  const sendRequest = async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setIsSendingRequest(true);
    setRequestResponse(null);
    setRightPanelTab("response");

    const startTime = performance.now();

    try {
      // Build headers object
      const headersObj: Record<string, string> = {};
      headers.filter(h => h.enabled && h.key.trim()).forEach(h => {
        headersObj[h.key] = h.value;
      });

      // Build request options
      const requestOptions: RequestInit = {
        method,
        headers: headersObj,
      };

      // Add body for methods that support it
      if (["POST", "PUT", "PATCH"].includes(method)) {
        if (bodyType === "raw") {
          requestOptions.body = body;
        } else if (bodyType === "form-data") {
          const formDataObj = new FormData();
          formData.filter(f => f.enabled && f.key.trim()).forEach(f => {
            formDataObj.append(f.key, f.value);
          });
          requestOptions.body = formDataObj;
          // Remove content-type header to let browser set it with boundary
          delete headersObj["Content-Type"];
        } else if (bodyType === "x-www-form-urlencoded") {
          const params = new URLSearchParams();
          formData.filter(f => f.enabled && f.key.trim()).forEach(f => {
            params.append(f.key, f.value);
          });
          requestOptions.body = params.toString();
          headersObj["Content-Type"] = "application/x-www-form-urlencoded";
        }
      }

      const response = await fetch(url, requestOptions);
      const endTime = performance.now();

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Get response body as text
      const responseBody = await response.text();

      setRequestResponse({
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        duration: Math.round(endTime - startTime),
      });
    } catch (error) {
      const endTime = performance.now();
      setRequestResponse({
        status: 0,
        statusText: "Network Error",
        headers: {},
        body: error instanceof Error ? error.message : "Failed to send request",
        duration: Math.round(endTime - startTime),
      });
      toast.error("Failed to send request");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleActionButton = async () => {
    if (actionMode === "analyze") {
      await analyzeRequest();
      setRightPanelTab("match");
    } else {
      // Request mode: analyze first, then send request
      await analyzeRequest();
      sendRequest();
    }
  };

  const analyzeRequest = async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    const startTime = Date.now();
    setIsAnalyzing(true);
    setMatchResult(null);

    try {
      let matchedService: Service | null = null;
      let matchedServer: ServerInfo | null = null;
      let matchedOperation: MatchResult["operation"] = null;
      let spec: any = null;
      let validationErrors: string[] = [];
      let validationWarnings: string[] = [];

      // Helper functions that will be used in both locked and auto-match modes
      const extractPathValues = (requestUrl: string, pathTemplate: string): Record<string, string> => {
        try {
          const urlObj = new URL(requestUrl);
          const requestPath = urlObj.pathname;
          const templateParts = pathTemplate.split('/');
          const requestParts = requestPath.split('/');
          const values: Record<string, string> = {};
          
          templateParts.forEach((part, i) => {
            if (part.startsWith('{') && part.endsWith('}')) {
              const paramName = part.slice(1, -1);
              values[paramName] = requestParts[i] || '';
            }
          });
          return values;
        } catch {
          return {};
        }
      };

      const validateParamValue = (value: string | null, type: string, required: boolean): { isValid: boolean; reason: string } => {
        if (!value || value.trim() === '') {
          if (required) {
            return { isValid: false, reason: 'Required parameter is missing' };
          }
          return { isValid: true, reason: 'Optional parameter not provided' };
        }
        
        switch (type) {
          case 'integer':
            if (!/^-?\d+$/.test(value)) {
              return { isValid: false, reason: `Expected integer, got "${value}"` };
            }
            break;
          case 'number':
            if (isNaN(Number(value))) {
              return { isValid: false, reason: `Expected number, got "${value}"` };
            }
            break;
          case 'boolean':
            if (!['true', 'false'].includes(value.toLowerCase())) {
              return { isValid: false, reason: `Expected boolean (true/false), got "${value}"` };
            }
            break;
        }
        
        return { isValid: true, reason: 'Value matches expected type' };
      };

      const buildOperationResult = (
        service: Service,
        spec: any,
        pathTemplate: string,
        opMethod: string
      ) => {
        const pathMethods = spec.paths[pathTemplate] as Record<string, any>;
        const lowerMethod = opMethod.toLowerCase();
        const operationDef = pathMethods[lowerMethod];
        
        if (!operationDef) return null;

        const servers = spec.servers || [{ url: "/" }];
        const server = servers[0];
        const serverUrl = server.url;
        
        const serverVariables: ServerVariable[] = [];
        if (server.variables) {
          for (const [varName, varDef] of Object.entries(server.variables as Record<string, any>)) {
            serverVariables.push({
              name: varName,
              value: varDef.default || '',
              default: varDef.default || '',
              description: varDef.description,
              enum: varDef.enum,
            });
          }
        }
        
        let resolvedUrl = serverUrl;
        serverVariables.forEach(v => {
          resolvedUrl = resolvedUrl.replace(`{${v.name}}`, v.value);
        });

        const serverInfo: ServerInfo = {
          index: 0,
          url: serverUrl,
          resolvedUrl,
          description: server.description,
          variables: serverVariables,
        };

        const parameters = operationDef.parameters || [];
        const pathValues = extractPathValues(url, pathTemplate);

        const pathParameters: ParameterInfo[] = parameters
          .filter((p: any) => p.in === "path")
          .map((p: any) => {
            const value = pathValues[p.name] || null;
            const defaultValue = p.schema?.default !== undefined ? String(p.schema.default) : null;
            const isUsingDefault = value === null && defaultValue !== null;
            const effectiveValue = value ?? defaultValue;
            const validation = validateParamValue(effectiveValue, p.schema?.type || 'string', p.required ?? true);
            return {
              name: p.name,
              type: p.schema?.type || "string",
              required: p.required ?? true,
              value,
              defaultValue,
              isUsingDefault,
              isUnspecified: false,
              isValid: validation.isValid,
              validationReason: validation.reason,
              description: p.description,
              rawJson: p,
            };
          });

        // Get spec query parameter names for comparison
        const specQueryParamNames = parameters
          .filter((p: any) => p.in === "query")
          .map((p: any) => p.name.toLowerCase());

        const queryParameters: ParameterInfo[] = parameters
          .filter((p: any) => p.in === "query")
          .map((p: any) => {
            const queryParam = queryParams.find(qp => qp.enabled && qp.key.toLowerCase() === p.name.toLowerCase());
            const value = queryParam?.value || null;
            const defaultValue = p.schema?.default !== undefined ? String(p.schema.default) : null;
            const isUsingDefault = value === null && defaultValue !== null;
            const effectiveValue = value ?? defaultValue;
            const validation = validateParamValue(effectiveValue, p.schema?.type || 'string', p.required ?? false);
            return {
              name: p.name,
              type: p.schema?.type || "string",
              required: p.required ?? false,
              value,
              defaultValue,
              isUsingDefault,
              isUnspecified: false,
              isValid: validation.isValid,
              validationReason: validation.reason,
              description: p.description,
              rawJson: p,
            };
          });

        // Add unspecified query parameters (in request but not in spec)
        const unspecifiedQueryParams: ParameterInfo[] = queryParams
          .filter(qp => qp.enabled && qp.key.trim() && !specQueryParamNames.includes(qp.key.toLowerCase()))
          .map(qp => ({
            name: qp.key,
            type: 'unknown',
            required: false,
            value: qp.value,
            defaultValue: null,
            isUsingDefault: false,
            isUnspecified: true,
            isValid: true,
            validationReason: 'Parameter not in specification',
            description: undefined,
            rawJson: {},
          }));
        
        queryParameters.push(...unspecifiedQueryParams);

        // Get spec header parameter names for comparison
        const specHeaderParamNames = parameters
          .filter((p: any) => p.in === "header")
          .map((p: any) => p.name.toLowerCase());

        const headerParameters: ParameterInfo[] = parameters
          .filter((p: any) => p.in === "header")
          .map((p: any) => {
            const headerParam = headers.find(h => h.enabled && h.key.toLowerCase() === p.name.toLowerCase());
            const value = headerParam?.value || null;
            const defaultValue = p.schema?.default !== undefined ? String(p.schema.default) : null;
            const isUsingDefault = value === null && defaultValue !== null;
            const effectiveValue = value ?? defaultValue;
            const validation = validateParamValue(effectiveValue, p.schema?.type || 'string', p.required ?? false);
            return {
              name: p.name,
              type: p.schema?.type || "string",
              required: p.required ?? false,
              value,
              defaultValue,
              isUsingDefault,
              isUnspecified: false,
              isValid: validation.isValid,
              validationReason: validation.reason,
              description: p.description,
              rawJson: p,
            };
          });

        // Add unspecified header parameters (in request but not in spec)
        // Exclude common headers that are typically not defined in OpenAPI specs
        const commonHeaders = ['content-type', 'accept', 'authorization', 'user-agent', 'host', 'connection', 'cache-control'];
        const unspecifiedHeaderParams: ParameterInfo[] = headers
          .filter(h => h.enabled && h.key.trim() && 
            !specHeaderParamNames.includes(h.key.toLowerCase()) &&
            !commonHeaders.includes(h.key.toLowerCase()))
          .map(h => ({
            name: h.key,
            type: 'unknown',
            required: false,
            value: h.value,
            defaultValue: null,
            isUsingDefault: false,
            isUnspecified: true,
            isValid: true,
            validationReason: 'Parameter not in specification',
            description: undefined,
            rawJson: {},
          }));
        
        headerParameters.push(...unspecifiedHeaderParams);

        // Extract body properties from requestBody schema
        const bodyProperties: BodyPropertyInfo[] = [];
        let bodyContentType: string | undefined;
        
        if (operationDef.requestBody) {
          const content = operationDef.requestBody.content;
          if (content) {
            // Try to find JSON content type first
            const jsonContentType = Object.keys(content).find(ct => ct.includes('json'));
            bodyContentType = jsonContentType || Object.keys(content)[0];
            
            if (bodyContentType && content[bodyContentType]?.schema) {
              const schema = content[bodyContentType].schema;
              const requiredFields = schema.required || [];
              
              // Parse the request body to get actual values
              let parsedBody: Record<string, any> = {};
              if (body.trim()) {
                try {
                  parsedBody = JSON.parse(body);
                } catch {
                  // Body is not valid JSON
                }
              }
              
              // Extract properties from schema
              if (schema.properties) {
                for (const [propName, propDef] of Object.entries(schema.properties as Record<string, any>)) {
                  const isRequired = requiredFields.includes(propName);
                  const value = parsedBody[propName];
                  const propType = propDef.type || 'any';
                  
                  let isValid = true;
                  let validationReason = 'Value matches expected type';
                  
                  if (value === undefined || value === null) {
                    if (isRequired) {
                      isValid = false;
                      validationReason = 'Required property is missing';
                    } else {
                      validationReason = 'Optional property not provided';
                    }
                  } else {
                    // Type validation
                    switch (propType) {
                      case 'string':
                        if (typeof value !== 'string') {
                          isValid = false;
                          validationReason = `Expected string, got ${typeof value}`;
                        }
                        break;
                      case 'integer':
                        if (!Number.isInteger(value)) {
                          isValid = false;
                          validationReason = `Expected integer, got ${typeof value}`;
                        }
                        break;
                      case 'number':
                        if (typeof value !== 'number') {
                          isValid = false;
                          validationReason = `Expected number, got ${typeof value}`;
                        }
                        break;
                      case 'boolean':
                        if (typeof value !== 'boolean') {
                          isValid = false;
                          validationReason = `Expected boolean, got ${typeof value}`;
                        }
                        break;
                      case 'array':
                        if (!Array.isArray(value)) {
                          isValid = false;
                          validationReason = `Expected array, got ${typeof value}`;
                        }
                        break;
                      case 'object':
                        if (typeof value !== 'object' || Array.isArray(value)) {
                          isValid = false;
                          validationReason = `Expected object, got ${typeof value}`;
                        }
                        break;
                    }
                  }
                  
                  bodyProperties.push({
                    name: propName,
                    type: propType,
                    required: isRequired,
                    value: value !== undefined ? value : null,
                    isValid,
                    validationReason,
                    description: propDef.description,
                    rawJson: propDef,
                  });
                }
              }
            }
          }
        }

        // Extract response schema for successful responses (2xx)
        let responseSchema: any = undefined;
        if (operationDef.responses) {
          // Look for 200, 201, or default response
          const successResponse = operationDef.responses['200'] || 
                                  operationDef.responses['201'] || 
                                  operationDef.responses['default'];
          if (successResponse?.content) {
            const jsonContent = Object.keys(successResponse.content).find(ct => ct.includes('json'));
            if (jsonContent && successResponse.content[jsonContent]?.schema) {
              responseSchema = successResponse.content[jsonContent].schema;
            }
          }
        }

        const operation: MatchResult["operation"] = {
          path: pathTemplate,
          method: opMethod,
          operationId: operationDef.operationId,
          summary: operationDef.summary,
          description: operationDef.description,
          pathParameters,
          queryParameters,
          headerParameters,
          bodyProperties,
          bodyContentType,
          responseSchema,
        };

        const validationResult = validateRequest(spec, operationDef, body, headers, queryParams);

        return { service, serverInfo, operation, errors: validationResult.errors, warnings: validationResult.warnings };
      };

      // If locked and we have a selection, use it
      if (isLocked && selectedServiceId && selectedOperationKey) {
        const service = services.find(s => s.id === selectedServiceId);
        if (service) {
          spec = parsedSpecs[selectedServiceId] || await parseOpenApiSpec(service);
          if (spec) {
            const [opMethod, ...pathParts] = selectedOperationKey.split(':');
            const pathTemplate = pathParts.join(':'); // Handle paths with colons
            
            const result = buildOperationResult(service, spec, pathTemplate, opMethod);
            if (result) {
              matchedService = result.service;
              matchedServer = result.serverInfo;
              matchedOperation = result.operation;
              validationErrors = result.errors;
              validationWarnings = result.warnings;
            }
          }
        }
      } else {
        // Auto-match mode
        for (const service of services) {
          spec = await parseOpenApiSpec(service);
          if (!spec) continue;

          const servers = spec.servers || [{ url: "/" }];
          
          for (let serverIndex = 0; serverIndex < servers.length; serverIndex++) {
            const server = servers[serverIndex];
            const serverUrl = server.url;
            
            const serverVariables: ServerVariable[] = [];
            if (server.variables) {
              for (const [varName, varDef] of Object.entries(server.variables as Record<string, any>)) {
                serverVariables.push({
                  name: varName,
                  value: varDef.default || '',
                  default: varDef.default || '',
                  description: varDef.description,
                  enum: varDef.enum,
                });
              }
            }
            
            let resolvedUrl = serverUrl;
            serverVariables.forEach(v => {
              resolvedUrl = resolvedUrl.replace(`{${v.name}}`, v.value);
            });
            
            if (spec.paths) {
              for (const [pathTemplate, pathItem] of Object.entries(spec.paths)) {
                const pathMethods = pathItem as Record<string, any>;
                const lowerMethod = method.toLowerCase();
                
                if (pathMethods[lowerMethod]) {
                  if (matchUrlToPath(url, serverUrl, pathTemplate)) {
                    matchedService = service;
                    matchedServer = {
                      index: serverIndex,
                      url: serverUrl,
                      resolvedUrl,
                      description: server.description,
                      variables: serverVariables,
                    };
                    
                    const parameters = pathMethods[lowerMethod].parameters || [];
                    const pathValues = extractPathValues(url, pathTemplate);
                    
                    const pathParameters: ParameterInfo[] = parameters
                      .filter((p: any) => p.in === "path")
                      .map((p: any) => {
                        const value = pathValues[p.name] || null;
                        const defaultValue = p.schema?.default !== undefined ? String(p.schema.default) : null;
                        const isUsingDefault = value === null && defaultValue !== null;
                        const effectiveValue = value ?? defaultValue;
                        const validation = validateParamValue(effectiveValue, p.schema?.type || 'string', p.required ?? true);
                        return {
                          name: p.name,
                          type: p.schema?.type || "string",
                          required: p.required ?? true,
                          value,
                          defaultValue,
                          isUsingDefault,
                          isUnspecified: false,
                          isValid: validation.isValid,
                          validationReason: validation.reason,
                          description: p.description,
                          rawJson: p,
                        };
                      });

                    // Get spec query parameter names for comparison
                    const specQueryParamNames = parameters
                      .filter((p: any) => p.in === "query")
                      .map((p: any) => p.name.toLowerCase());
                    
                    const queryParameters: ParameterInfo[] = parameters
                      .filter((p: any) => p.in === "query")
                      .map((p: any) => {
                        const queryParam = queryParams.find(qp => qp.enabled && qp.key.toLowerCase() === p.name.toLowerCase());
                        const value = queryParam?.value || null;
                        const defaultValue = p.schema?.default !== undefined ? String(p.schema.default) : null;
                        const isUsingDefault = value === null && defaultValue !== null;
                        const effectiveValue = value ?? defaultValue;
                        const validation = validateParamValue(effectiveValue, p.schema?.type || 'string', p.required ?? false);
                        return {
                          name: p.name,
                          type: p.schema?.type || "string",
                          required: p.required ?? false,
                          value,
                          defaultValue,
                          isUsingDefault,
                          isUnspecified: false,
                          isValid: validation.isValid,
                          validationReason: validation.reason,
                          description: p.description,
                          rawJson: p,
                        };
                      });

                    // Add unspecified query parameters (in request but not in spec)
                    const unspecifiedQueryParams: ParameterInfo[] = queryParams
                      .filter(qp => qp.enabled && qp.key.trim() && !specQueryParamNames.includes(qp.key.toLowerCase()))
                      .map(qp => ({
                        name: qp.key,
                        type: 'unknown',
                        required: false,
                        value: qp.value,
                        defaultValue: null,
                        isUsingDefault: false,
                        isUnspecified: true,
                        isValid: true,
                        validationReason: 'Parameter not in specification',
                        description: undefined,
                        rawJson: {},
                      }));
                    
                    queryParameters.push(...unspecifiedQueryParams);

                    // Get spec header parameter names for comparison
                    const specHeaderParamNames = parameters
                      .filter((p: any) => p.in === "header")
                      .map((p: any) => p.name.toLowerCase());

                    const headerParameters: ParameterInfo[] = parameters
                      .filter((p: any) => p.in === "header")
                      .map((p: any) => {
                        const headerParam = headers.find(h => h.enabled && h.key.toLowerCase() === p.name.toLowerCase());
                        const value = headerParam?.value || null;
                        const defaultValue = p.schema?.default !== undefined ? String(p.schema.default) : null;
                        const isUsingDefault = value === null && defaultValue !== null;
                        const effectiveValue = value ?? defaultValue;
                        const validation = validateParamValue(effectiveValue, p.schema?.type || 'string', p.required ?? false);
                        return {
                          name: p.name,
                          type: p.schema?.type || "string",
                          required: p.required ?? false,
                          value,
                          defaultValue,
                          isUsingDefault,
                          isUnspecified: false,
                          isValid: validation.isValid,
                          validationReason: validation.reason,
                          description: p.description,
                          rawJson: p,
                        };
                      });

                    // Add unspecified header parameters (in request but not in spec)
                    const commonHeaders = ['content-type', 'accept', 'authorization', 'user-agent', 'host', 'connection', 'cache-control'];
                    const unspecifiedHeaderParams: ParameterInfo[] = headers
                      .filter(h => h.enabled && h.key.trim() && 
                        !specHeaderParamNames.includes(h.key.toLowerCase()) &&
                        !commonHeaders.includes(h.key.toLowerCase()))
                      .map(h => ({
                        name: h.key,
                        type: 'unknown',
                        required: false,
                        value: h.value,
                        defaultValue: null,
                        isUsingDefault: false,
                        isUnspecified: true,
                        isValid: true,
                        validationReason: 'Parameter not in specification',
                        description: undefined,
                        rawJson: {},
                      }));
                    
                    headerParameters.push(...unspecifiedHeaderParams);

                    // Extract body properties in auto-match mode
                    const bodyProperties: BodyPropertyInfo[] = [];
                    let bodyContentType: string | undefined;
                    const operationDef = pathMethods[lowerMethod];
                    
                    if (operationDef.requestBody) {
                      const content = operationDef.requestBody.content;
                      if (content) {
                        const jsonContentType = Object.keys(content).find(ct => ct.includes('json'));
                        bodyContentType = jsonContentType || Object.keys(content)[0];
                        
                        if (bodyContentType && content[bodyContentType]?.schema) {
                          const schema = content[bodyContentType].schema;
                          const requiredFields = schema.required || [];
                          
                          let parsedBody: Record<string, any> = {};
                          if (body.trim()) {
                            try {
                              parsedBody = JSON.parse(body);
                            } catch {
                              // Body is not valid JSON
                            }
                          }
                          
                          if (schema.properties) {
                            for (const [propName, propDef] of Object.entries(schema.properties as Record<string, any>)) {
                              const isRequired = requiredFields.includes(propName);
                              const value = parsedBody[propName];
                              const propType = propDef.type || 'any';
                              
                              let isValid = true;
                              let validationReason = 'Value matches expected type';
                              
                              if (value === undefined || value === null) {
                                if (isRequired) {
                                  isValid = false;
                                  validationReason = 'Required property is missing';
                                } else {
                                  validationReason = 'Optional property not provided';
                                }
                              } else {
                                switch (propType) {
                                  case 'string':
                                    if (typeof value !== 'string') {
                                      isValid = false;
                                      validationReason = `Expected string, got ${typeof value}`;
                                    }
                                    break;
                                  case 'integer':
                                    if (!Number.isInteger(value)) {
                                      isValid = false;
                                      validationReason = `Expected integer, got ${typeof value}`;
                                    }
                                    break;
                                  case 'number':
                                    if (typeof value !== 'number') {
                                      isValid = false;
                                      validationReason = `Expected number, got ${typeof value}`;
                                    }
                                    break;
                                  case 'boolean':
                                    if (typeof value !== 'boolean') {
                                      isValid = false;
                                      validationReason = `Expected boolean, got ${typeof value}`;
                                    }
                                    break;
                                  case 'array':
                                    if (!Array.isArray(value)) {
                                      isValid = false;
                                      validationReason = `Expected array, got ${typeof value}`;
                                    }
                                    break;
                                  case 'object':
                                    if (typeof value !== 'object' || Array.isArray(value)) {
                                      isValid = false;
                                      validationReason = `Expected object, got ${typeof value}`;
                                    }
                                    break;
                                }
                              }
                              
                              bodyProperties.push({
                                name: propName,
                                type: propType,
                                required: isRequired,
                                value: value !== undefined ? value : null,
                                isValid,
                                validationReason,
                                description: propDef.description,
                                rawJson: propDef,
                              });
                            }
                          }
                        }
                      }
                    }

                    // Extract response schema for successful responses (2xx)
                    let responseSchema: any = undefined;
                    if (operationDef.responses) {
                      const successResponse = operationDef.responses['200'] || 
                                              operationDef.responses['201'] || 
                                              operationDef.responses['default'];
                      if (successResponse?.content) {
                        const jsonContent = Object.keys(successResponse.content).find(ct => ct.includes('json'));
                        if (jsonContent && successResponse.content[jsonContent]?.schema) {
                          responseSchema = successResponse.content[jsonContent].schema;
                        }
                      }
                    }
                    
                    matchedOperation = {
                      path: pathTemplate,
                      method: method,
                      operationId: pathMethods[lowerMethod].operationId,
                      summary: pathMethods[lowerMethod].summary,
                      description: pathMethods[lowerMethod].description,
                      pathParameters,
                      queryParameters,
                      headerParameters,
                      bodyProperties,
                      bodyContentType,
                      responseSchema,
                    };
                    
                    const validationResult = validateRequest(spec, pathMethods[lowerMethod], body, headers, queryParams);
                    validationErrors = validationResult.errors;
                    validationWarnings = validationResult.warnings;
                    break;
                  }
                }
              }
            }
            
            if (matchedOperation) break;
          }
          
          if (matchedOperation) break;
        }
      }

      setMatchResult({
        matched: !!matchedOperation,
        service: matchedService,
        server: matchedServer,
        operation: matchedOperation,
        validationErrors,
        validationWarnings,
        spec,
      });

      if (!matchedOperation) {
        if (isLocked) {
          toast.info("Locked operation not found - check your selection");
        } else {
          toast.info("No matching API endpoint found in your services");
        }
      }
    } catch (error) {
      toast.error("Failed to analyze request");
    } finally {
      // Ensure minimum 1 second loading for user feedback
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
      }
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/30 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">API Request Tester</h1>
              <p className="text-sm text-muted-foreground">
                Test requests against your OpenAPI specifications
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-lg border border-border">
          <ResizablePanel defaultSize={50} minSize={30}>
            {/* Left Panel - Request Builder */}
            <Card className="border-0 bg-card/50 h-full rounded-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Request Builder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* URL Bar */}
              <div className="flex gap-2">
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="w-[120px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HTTP_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        <span className={
                          m === "GET" ? "text-green-500" :
                          m === "POST" ? "text-yellow-500" :
                          m === "PUT" ? "text-blue-500" :
                          m === "PATCH" ? "text-purple-500" :
                          m === "DELETE" ? "text-red-500" :
                          "text-muted-foreground"
                        }>
                          {m}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Enter request URL (e.g., https://api.example.com/users)"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isAnalyzing && !isSendingRequest) {
                      handleActionButton();
                    }
                  }}
                  className="flex-1 bg-background"
                />
                <div className="flex">
                  <Button 
                    onClick={handleActionButton} 
                    disabled={isAnalyzing || isSendingRequest}
                    className="rounded-r-none border-r-0 relative min-w-[110px]"
                  >
                    <span className={isAnalyzing || isSendingRequest ? "invisible" : ""}>
                      {actionMode === "analyze" ? (
                        <Search className="h-4 w-4 mr-2 inline" />
                      ) : (
                        <Send className="h-4 w-4 mr-2 inline" />
                      )}
                      {actionMode === "analyze" ? "Analyze" : "Request"}
                    </span>
                    {(isAnalyzing || isSendingRequest) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                      </div>
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="default" 
                        className="rounded-l-none px-2"
                        disabled={isAnalyzing || isSendingRequest}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover z-50">
                      <DropdownMenuItem 
                        onClick={() => setActionMode("analyze")}
                        className={actionMode === "analyze" ? "bg-accent" : ""}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Analyze
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setActionMode("request")}
                        className={actionMode === "request" ? "bg-accent" : ""}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Request
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Tabs for Params, Headers, Body, OpenAPI */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start bg-muted/50">
                  <TabsTrigger value="params">Query Params</TabsTrigger>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                  <TabsTrigger value="body">Body</TabsTrigger>
                  <TabsTrigger value="openapi">OpenAPI</TabsTrigger>
                </TabsList>

                <TabsContent value="params" className="space-y-3 mt-4">
                  {queryParams.map((param, index) => {
                    const validationStatus = param.enabled ? getQueryParamValidationStatus(param.key) : null;
                    const isDuplicate = param.enabled ? isQueryParamDuplicate(index, param.key) : false;
                    const borderClass = getValidationBorderClass(validationStatus, isDuplicate);
                    return (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="checkbox"
                          checked={param.enabled}
                          onChange={(e) => updateQueryParam(index, "enabled", e.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <Input
                          placeholder="Parameter name"
                          value={param.key}
                          onChange={(e) => updateQueryParam(index, "key", e.target.value)}
                          className={`flex-1 bg-background ${borderClass}`}
                        />
                        <Input
                          placeholder="Value"
                          value={param.value}
                          onChange={(e) => updateQueryParam(index, "value", e.target.value)}
                          className={`flex-1 bg-background ${borderClass}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQueryParam(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={addQueryParam}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Parameter
                  </Button>
                </TabsContent>

                <TabsContent value="headers" className="space-y-3 mt-4">
                  {headers.map((header, index) => {
                    const validationStatus = header.enabled ? getHeaderValidationStatus(header.key) : null;
                    const isDuplicate = header.enabled ? isHeaderDuplicate(index, header.key) : false;
                    const borderClass = getValidationBorderClass(validationStatus, isDuplicate);
                    return (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="checkbox"
                          checked={header.enabled}
                          onChange={(e) => updateHeader(index, "enabled", e.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <Input
                          placeholder="Header name"
                          value={header.key}
                          onChange={(e) => updateHeader(index, "key", e.target.value)}
                          className={`flex-1 bg-background ${borderClass}`}
                        />
                        <Input
                          placeholder="Value"
                          value={header.value}
                          onChange={(e) => updateHeader(index, "value", e.target.value)}
                          className={`flex-1 bg-background ${borderClass}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeHeader(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={addHeader}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Header
                  </Button>
                </TabsContent>

                <TabsContent value="body" className="mt-4">
                  <RequestBodyEditor
                    value={body}
                    onChange={setBody}
                    bodyType={bodyType}
                    onBodyTypeChange={setBodyType}
                    rawType={rawType}
                    onRawTypeChange={setRawType}
                    formData={formData}
                    onFormDataChange={setFormData}
                  />
                </TabsContent>

                <TabsContent value="openapi" className="mt-4">
                  <OpenAPIRequestTab
                    services={services}
                    selectedServiceId={openAPIServiceId}
                    selectedOperationKey={openAPIOperationKey}
                    formValues={openAPIFormValues}
                    onServiceChange={setOpenAPIServiceId}
                    onOperationChange={setOpenAPIOperationKey}
                    onFormValuesChange={setOpenAPIFormValues}
                    onOperationParsed={setOpenAPIOperation}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={50} minSize={30}>
            {/* Right Panel - Results */}
            <Card className="border-0 bg-card/50 h-full rounded-none overflow-auto">
              <CardHeader className="pb-4">
                <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as "match" | "response")}>
                  <div className="flex items-center justify-between mb-4">
                    <TabsList className="bg-muted/50">
                      <TabsTrigger value="match" className="flex items-center gap-2">
                        <FileCode className="h-4 w-4" />
                        OpenAPI Match Results
                        {matchResult?.operation && (() => {
                          const invalidCount = [
                            ...(matchResult.operation.pathParameters || []),
                            ...(matchResult.operation.queryParameters || []),
                            ...(matchResult.operation.headerParameters || []),
                            ...(matchResult.operation.bodyProperties || []),
                          ].filter(p => !p.isValid).length;
                          return (
                            <Badge 
                              variant={invalidCount > 0 ? "destructive" : "default"}
                              className={`ml-1 text-xs ${invalidCount === 0 ? "bg-green-600 hover:bg-green-700" : ""}`}
                            >
                              {invalidCount} invalid
                            </Badge>
                          );
                        })()}
                      </TabsTrigger>
                      <TabsTrigger value="response" className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        Response
                        {requestResponse && (
                          <Badge 
                            variant={requestResponse.status >= 200 && requestResponse.status < 300 ? "default" : "destructive"}
                            className="ml-1 text-xs"
                          >
                            {requestResponse.status}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                    {rightPanelTab === "match" && (
                      <Button
                        variant={isLocked ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsLocked(!isLocked)}
                        className="gap-2"
                      >
                        {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        {isLocked ? "Locked" : "Auto"}
                      </Button>
                    )}
                  </div>
                  
                  <TabsContent value="match" className="mt-0">
                    {/* Manual Selection Controls */}
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-sm text-muted-foreground">Select API Service</label>
                        <Select 
                          value={selectedServiceId || "__auto__"} 
                          onValueChange={(value) => {
                            setSelectedServiceId(value === "__auto__" ? null : value);
                            setSelectedOperationKey(null);
                          }}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Auto-detect from URL" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="__auto__">Auto-detect</SelectItem>
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
                          <label className="text-sm text-muted-foreground">
                            Select Operation
                            {selectedOperationKey && (() => {
                              const selectedOp = availableOperations.find(op => op.key === selectedOperationKey);
                              return selectedOp?.operationId ? (
                                <span className="ml-2 font-mono text-foreground">{selectedOp.operationId}</span>
                              ) : null;
                            })()}
                          </label>
                          <Select 
                            value={selectedOperationKey || "__auto__"} 
                            onValueChange={(value) => setSelectedOperationKey(value === "__auto__" ? null : value)}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Auto-detect from URL & method">
                                {selectedOperationKey ? (() => {
                                  const selectedOp = availableOperations.find(op => op.key === selectedOperationKey);
                                  return selectedOp ? (
                                    <span>
                                      <span className={`font-mono text-xs mr-2 ${
                                        selectedOp.method === "GET" ? "text-green-500" :
                                        selectedOp.method === "POST" ? "text-yellow-500" :
                                        selectedOp.method === "PUT" ? "text-blue-500" :
                                        selectedOp.method === "DELETE" ? "text-red-500" :
                                        "text-muted-foreground"
                                      }`}>
                                        {selectedOp.method}
                                      </span>
                                      <span className="font-mono text-sm text-foreground">{selectedOp.path}</span>
                                    </span>
                                  ) : null;
                                })() : (
                                  <span className="text-muted-foreground">Auto-detect</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50 max-h-[300px]">
                              <SelectItem value="__auto__">Auto-detect</SelectItem>
                              {availableOperations.map((op) => (
                                <SelectItem key={op.key} value={op.key}>
                                  <span className={`font-mono text-xs mr-2 ${
                                    op.method === "GET" ? "text-green-500" :
                                    op.method === "POST" ? "text-yellow-500" :
                                    op.method === "PUT" ? "text-blue-500" :
                                    op.method === "DELETE" ? "text-red-500" :
                                    "text-muted-foreground"
                                  }`}>
                                    {op.method}
                                  </span>
                                  {op.operationId && (
                                    <span className="font-mono text-sm mr-2">{op.operationId}</span>
                                  )}
                                  <span className="font-mono text-sm text-muted-foreground">{op.path}</span>
                                  {op.summary && (
                                    <span className="text-muted-foreground text-xs ml-2">— {op.summary}</span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {isLocked && selectedServiceId && selectedOperationKey && (
                        <div className="flex items-center gap-2 text-xs text-primary">
                          <Lock className="h-3 w-3" />
                          <span>Validation locked to selected operation</span>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="response" className="mt-0">
                    {requestResponse && (
                      <div className="flex items-center gap-4 text-sm">
                        <Badge 
                          variant={requestResponse.status >= 200 && requestResponse.status < 300 ? "default" : "destructive"}
                          className={requestResponse.status >= 200 && requestResponse.status < 300 ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                          {requestResponse.status} {requestResponse.statusText}
                        </Badge>
                        <span className="text-muted-foreground">{requestResponse.duration}ms</span>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardHeader>
              <CardContent>
                {rightPanelTab === "match" ? (
                  <>
                    {!matchResult ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Enter a URL and click "Analyze" to match against your OpenAPI specs</p>
                      </div>
                    ) : !matchResult.matched ? (
                      <div className="text-center py-12">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-warning" />
                        <p className="text-foreground font-medium">No Match Found</p>
                        <p className="text-muted-foreground text-sm mt-2">
                          The request URL doesn't match any endpoint in your registered services
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Matched Service */}
                        <Collapsible
                          open={!collapsedSections.service}
                          onOpenChange={() => toggleSection('service')}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="h-4 w-4 text-success" />
                              Matched Service
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                {collapsedSections.service ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                            <div className="bg-background rounded-lg p-4 border border-border mt-2">
                              <p className="font-medium text-foreground">{matchResult.service?.name}</p>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

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
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                {collapsedSections.server ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                            <div className="bg-background rounded-lg p-4 border border-border space-y-3 mt-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Server Index:</span>
                                <Badge variant="outline" className="font-mono">{matchResult.server?.index}</Badge>
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
                                <p className="text-sm text-muted-foreground italic">{matchResult.server.description}</p>
                              )}
                              
                              {/* Server Variables */}
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
                                          <tr key={index} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                            <td className="px-3 py-2 font-mono text-foreground">{variable.name}</td>
                                            <td className="px-3 py-2">
                                              <Badge variant="secondary" className="font-mono">{variable.value}</Badge>
                                              {variable.default && variable.value === variable.default && (
                                                <span className="text-xs text-muted-foreground ml-2">(default)</span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground">{variable.description || '-'}</td>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                {collapsedSections.operation ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                            <div className="bg-background rounded-lg p-4 border border-border space-y-3 mt-2">
                              <div className="flex items-center gap-3">
                                <Badge className={
                                  matchResult.operation?.method === "GET" ? "bg-green-600 hover:bg-green-700" :
                                  matchResult.operation?.method === "POST" ? "bg-yellow-600 hover:bg-yellow-700" :
                                  matchResult.operation?.method === "PUT" ? "bg-blue-600 hover:bg-blue-700" :
                                  matchResult.operation?.method === "DELETE" ? "bg-red-600 hover:bg-red-700" :
                                  "bg-muted"
                                }>
                                  {matchResult.operation?.method}
                                </Badge>
                                <code className="text-foreground font-medium">{matchResult.operation?.path}</code>
                              </div>
                              {matchResult.operation?.operationId && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">Operation ID:</span>
                                  <code className="text-sm text-primary">{matchResult.operation.operationId}</code>
                                </div>
                              )}
                              {matchResult.operation?.summary && (
                                <p className="text-sm text-muted-foreground">{matchResult.operation.summary}</p>
                              )}
                              {matchResult.operation?.description && (
                                <Collapsible open={showDescription} onOpenChange={setShowDescription}>
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="p-0 h-auto text-primary hover:text-primary/80">
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
                                      {matchResult.operation.description}
                                    </p>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Path Parameters */}
                        {matchResult.operation?.pathParameters && matchResult.operation.pathParameters.length > 0 && (
                          <Collapsible
                            open={!collapsedSections.pathParams}
                            onOpenChange={() => toggleSection('pathParams')}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Route className="h-4 w-4" />
                                Path Parameters
                                <Badge variant="secondary" className="text-xs ml-1">
                                  {matchResult.operation.pathParameters.length}
                                </Badge>
                                {(() => {
                                  const invalidCount = matchResult.operation!.pathParameters.filter(p => !p.isValid).length;
                                  return (
                                    <Badge 
                                      variant={invalidCount > 0 ? "destructive" : "default"} 
                                      className={`text-xs ${invalidCount === 0 ? "bg-green-600 hover:bg-green-700" : ""}`}
                                    >
                                      {invalidCount} invalid
                                    </Badge>
                                  );
                                })()}
                              </div>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  {collapsedSections.pathParams ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                              <div className="bg-background rounded-lg p-4 border border-border mt-2">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <SortableHeader 
                                          column="name" 
                                          label="Name" 
                                          currentSort={pathParamSort} 
                                          onSort={(col) => handleSort(col, pathParamSort, setPathParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="type" 
                                          label="Type" 
                                          currentSort={pathParamSort} 
                                          onSort={(col) => handleSort(col, pathParamSort, setPathParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="required" 
                                          label="Required" 
                                          currentSort={pathParamSort} 
                                          onSort={(col) => handleSort(col, pathParamSort, setPathParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="value" 
                                          label="Value" 
                                          currentSort={pathParamSort} 
                                          onSort={(col) => handleSort(col, pathParamSort, setPathParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="isValid" 
                                          label="Valid" 
                                          currentSort={pathParamSort} 
                                          onSort={(col) => handleSort(col, pathParamSort, setPathParamSort)} 
                                        />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortParameters(matchResult.operation.pathParameters, pathParamSort).map((param, index) => (
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
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Query Parameters */}
                        {matchResult.operation?.queryParameters && matchResult.operation.queryParameters.length > 0 && (
                          <Collapsible
                            open={!collapsedSections.queryParams}
                            onOpenChange={() => toggleSection('queryParams')}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileCode className="h-4 w-4" />
                                Query Parameters
                                <Badge variant="secondary" className="text-xs ml-1">
                                  {matchResult.operation.queryParameters.length}
                                </Badge>
                                {(() => {
                                  const invalidCount = matchResult.operation!.queryParameters.filter(p => !p.isValid).length;
                                  return (
                                    <Badge 
                                      variant={invalidCount > 0 ? "destructive" : "default"} 
                                      className={`text-xs ${invalidCount === 0 ? "bg-green-600 hover:bg-green-700" : ""}`}
                                    >
                                      {invalidCount} invalid
                                    </Badge>
                                  );
                                })()}
                              </div>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  {collapsedSections.queryParams ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                              <div className="bg-background rounded-lg p-4 border border-border mt-2">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <SortableHeader 
                                          column="name" 
                                          label="Name" 
                                          currentSort={queryParamSort} 
                                          onSort={(col) => handleSort(col, queryParamSort, setQueryParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="type" 
                                          label="Type" 
                                          currentSort={queryParamSort} 
                                          onSort={(col) => handleSort(col, queryParamSort, setQueryParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="required" 
                                          label="Required" 
                                          currentSort={queryParamSort} 
                                          onSort={(col) => handleSort(col, queryParamSort, setQueryParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="value" 
                                          label="Value" 
                                          currentSort={queryParamSort} 
                                          onSort={(col) => handleSort(col, queryParamSort, setQueryParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="isValid" 
                                          label="Valid" 
                                          currentSort={queryParamSort} 
                                          onSort={(col) => handleSort(col, queryParamSort, setQueryParamSort)} 
                                        />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortParameters(matchResult.operation.queryParameters, queryParamSort).map((param, index) => (
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
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Header Parameters */}
                        {matchResult.operation?.headerParameters && matchResult.operation.headerParameters.length > 0 && (
                          <Collapsible
                            open={!collapsedSections.headerParams}
                            onOpenChange={() => toggleSection('headerParams')}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileCode className="h-4 w-4" />
                                Header Parameters
                                <Badge variant="secondary" className="text-xs ml-1">
                                  {matchResult.operation.headerParameters.length}
                                </Badge>
                                {(() => {
                                  const invalidCount = matchResult.operation!.headerParameters.filter(p => !p.isValid).length;
                                  return (
                                    <Badge 
                                      variant={invalidCount > 0 ? "destructive" : "default"} 
                                      className={`text-xs ${invalidCount === 0 ? "bg-green-600 hover:bg-green-700" : ""}`}
                                    >
                                      {invalidCount} invalid
                                    </Badge>
                                  );
                                })()}
                              </div>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  {collapsedSections.headerParams ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                              <div className="bg-background rounded-lg p-4 border border-border mt-2">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <SortableHeader 
                                          column="name" 
                                          label="Name" 
                                          currentSort={headerParamSort} 
                                          onSort={(col) => handleSort(col, headerParamSort, setHeaderParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="type" 
                                          label="Type" 
                                          currentSort={headerParamSort} 
                                          onSort={(col) => handleSort(col, headerParamSort, setHeaderParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="required" 
                                          label="Required" 
                                          currentSort={headerParamSort} 
                                          onSort={(col) => handleSort(col, headerParamSort, setHeaderParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="value" 
                                          label="Value" 
                                          currentSort={headerParamSort} 
                                          onSort={(col) => handleSort(col, headerParamSort, setHeaderParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="isValid" 
                                          label="Valid" 
                                          currentSort={headerParamSort} 
                                          onSort={(col) => handleSort(col, headerParamSort, setHeaderParamSort)} 
                                        />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortParameters(matchResult.operation.headerParameters, headerParamSort).map((param, index) => (
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
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Body Parameters */}
                        {matchResult.operation?.bodyProperties && matchResult.operation.bodyProperties.length > 0 && (
                          <Collapsible
                            open={!collapsedSections.bodyParams}
                            onOpenChange={() => toggleSection('bodyParams')}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileCode className="h-4 w-4" />
                                Body Properties
                                {matchResult.operation.bodyContentType && (
                                  <Badge variant="outline" className="text-xs ml-1">
                                    {matchResult.operation.bodyContentType}
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-xs ml-1">
                                  {matchResult.operation.bodyProperties.length}
                                </Badge>
                                {(() => {
                                  const invalidCount = matchResult.operation!.bodyProperties.filter(p => !p.isValid).length;
                                  return (
                                    <Badge 
                                      variant={invalidCount > 0 ? "destructive" : "default"} 
                                      className={`text-xs ${invalidCount === 0 ? "bg-green-600 hover:bg-green-700" : ""}`}
                                    >
                                      {invalidCount} invalid
                                    </Badge>
                                  );
                                })()}
                              </div>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  {collapsedSections.bodyParams ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                              <div className="bg-background rounded-lg p-4 border border-border mt-2">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <SortableHeader 
                                          column="name" 
                                          label="Name" 
                                          currentSort={bodyParamSort} 
                                          onSort={(col) => handleSort(col, bodyParamSort, setBodyParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="type" 
                                          label="Type" 
                                          currentSort={bodyParamSort} 
                                          onSort={(col) => handleSort(col, bodyParamSort, setBodyParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="required" 
                                          label="Required" 
                                          currentSort={bodyParamSort} 
                                          onSort={(col) => handleSort(col, bodyParamSort, setBodyParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="value" 
                                          label="Value" 
                                          currentSort={bodyParamSort} 
                                          onSort={(col) => handleSort(col, bodyParamSort, setBodyParamSort)} 
                                        />
                                        <SortableHeader 
                                          column="isValid" 
                                          label="Valid" 
                                          currentSort={bodyParamSort} 
                                          onSort={(col) => handleSort(col, bodyParamSort, setBodyParamSort)} 
                                        />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortParameters(matchResult.operation.bodyProperties.map(p => ({
                                        ...p,
                                        value: p.value !== null ? JSON.stringify(p.value) : null,
                                        isUsingDefault: false,
                                        isUnspecified: false
                                      })), bodyParamSort).map((param, index) => (
                                        <ExpandableParameterRow
                                          key={index}
                                          name={param.name}
                                          type={param.type}
                                          required={param.required}
                                          value={param.value}
                                          defaultValue={null}
                                          isUsingDefault={param.isUsingDefault}
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
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Validation */}
                        <Collapsible
                          open={!collapsedSections.validation}
                          onOpenChange={() => toggleSection('validation')}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <AlertCircle className="h-4 w-4" />
                              Validation
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                {collapsedSections.validation ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                            <div className="bg-background rounded-lg p-4 border border-border mt-2 space-y-4">
                              {matchResult.validationErrors.length === 0 && matchResult.validationWarnings.length === 0 ? (
                                <div className="flex items-center gap-2 text-success">
                                  <CheckCircle className="h-4 w-4" />
                                  <span>Request is valid</span>
                                </div>
                              ) : (
                                <>
                                  {matchResult.validationErrors.length > 0 && (
                                    <ul className="space-y-2">
                                      {matchResult.validationErrors.map((error, index) => (
                                        <li key={index} className="flex items-start gap-2 text-destructive text-sm">
                                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                          {error}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  {matchResult.validationWarnings.length > 0 && (
                                    <ul className="space-y-2">
                                      {matchResult.validationWarnings.map((warning, index) => (
                                        <li key={index} className="flex items-start gap-2 text-orange-500 text-sm">
                                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                          {warning}
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
                    )}
                  </>
                ) : (
                  /* Response Tab Content */
                  <>
                    {!requestResponse ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Send a request to see the response</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Response Headers */}
                        <Collapsible defaultOpen>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <FileCode className="h-4 w-4" />
                              Headers
                              <Badge variant="secondary" className="text-xs ml-1">
                                {Object.keys(requestResponse.headers).length}
                              </Badge>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                            <div className="bg-background rounded-lg p-4 border border-border mt-2">
                              {Object.keys(requestResponse.headers).length === 0 ? (
                                <p className="text-muted-foreground text-sm">No headers returned</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Value</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.entries(requestResponse.headers).map(([key, value], index) => (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                          <td className="px-3 py-2 font-mono text-foreground">{key}</td>
                                          <td className="px-3 py-2 font-mono text-muted-foreground break-all">{value}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Response Body */}
                        <Collapsible defaultOpen>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <FileCode className="h-4 w-4" />
                              Body
                              <Badge variant="secondary" className="text-xs ml-1">
                                {requestResponse.body.length} chars
                              </Badge>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                            <div className="bg-background rounded-lg p-4 border border-border mt-2">
                              <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-all max-h-[400px] overflow-auto">
                                <code>
                                  {(() => {
                                    const contentType = requestResponse.headers['content-type'] || requestResponse.headers['Content-Type'] || '';
                                    const isJson = contentType.includes('application/json');

                                    if (isJson) {
                                      try {
                                        JSON.parse(requestResponse.body); // Validate JSON
                                        const validationErrors = extractValidationErrors(matchResult);
                                        // Get response schema based on actual status code
                                        const responseSchema = getResponseSchemaForStatus(matchResult, requestResponse.status);
                                        return (
                                          <JsonResponseViewer
                                            jsonString={requestResponse.body}
                                            responseSchema={responseSchema}
                                            validationErrors={validationErrors}
                                          />
                                        );
                                      } catch {
                                        return requestResponse.body;
                                      }
                                    }
                                    return requestResponse.body;
                                  })()}
                                </code>
                              </pre>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
};

export default ApiTester;
