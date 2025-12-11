import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Send, Plus, Trash2, AlertCircle, CheckCircle, Server, Route, FileCode, Minus, Lock, Unlock, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import yaml from "js-yaml";

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
  isValid: boolean;
  validationReason: string;
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
  } | null;
  validationErrors: string[];
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
  const [services, setServices] = useState<Service[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    service: false,
    server: false,
    operation: false,
    pathParams: false,
    queryParams: false,
    headerParams: false,
    validation: false,
  });
  
  // Manual selection state
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedOperationKey, setSelectedOperationKey] = useState<string | null>(null);
  const [availableOperations, setAvailableOperations] = useState<OperationOption[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [parsedSpecs, setParsedSpecs] = useState<Record<string, any>>({});
  
  // Sorting state for parameter tables
  type SortColumn = 'name' | 'type' | 'required' | 'value' | 'isValid';
  type SortDirection = 'asc' | 'desc';
  const [pathParamSort, setPathParamSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: 'name', direction: 'asc' });
  const [queryParamSort, setQueryParamSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: 'name', direction: 'asc' });
  const [headerParamSort, setHeaderParamSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: 'name', direction: 'asc' });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
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
          comparison = (a.isValid === b.isValid) ? 0 : a.isValid ? -1 : 1;
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
      if (params.length > 0) {
        setQueryParams(params);
      }
    } catch {
      // Invalid URL, ignore
    }
  };

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

  const validateRequest = (spec: any, operation: any, requestBody: string, requestHeaders: KeyValuePair[], requestQueryParams: KeyValuePair[]): string[] => {
    const errors: string[] = [];

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

    return errors;
  };

  const analyzeRequest = async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setIsAnalyzing(true);
    setMatchResult(null);

    try {
      let matchedService: Service | null = null;
      let matchedServer: ServerInfo | null = null;
      let matchedOperation: MatchResult["operation"] = null;
      let spec: any = null;
      let validationErrors: string[] = [];

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
            const validation = validateParamValue(value, p.schema?.type || 'string', p.required ?? true);
            return {
              name: p.name,
              type: p.schema?.type || "string",
              required: p.required ?? true,
              value,
              isValid: validation.isValid,
              validationReason: validation.reason,
            };
          });

        const queryParameters: ParameterInfo[] = parameters
          .filter((p: any) => p.in === "query")
          .map((p: any) => {
            const queryParam = queryParams.find(qp => qp.enabled && qp.key.toLowerCase() === p.name.toLowerCase());
            const value = queryParam?.value || null;
            const validation = validateParamValue(value, p.schema?.type || 'string', p.required ?? false);
            return {
              name: p.name,
              type: p.schema?.type || "string",
              required: p.required ?? false,
              value,
              isValid: validation.isValid,
              validationReason: validation.reason,
            };
          });

        const headerParameters: ParameterInfo[] = parameters
          .filter((p: any) => p.in === "header")
          .map((p: any) => {
            const headerParam = headers.find(h => h.enabled && h.key.toLowerCase() === p.name.toLowerCase());
            const value = headerParam?.value || null;
            const validation = validateParamValue(value, p.schema?.type || 'string', p.required ?? false);
            return {
              name: p.name,
              type: p.schema?.type || "string",
              required: p.required ?? false,
              value,
              isValid: validation.isValid,
              validationReason: validation.reason,
            };
          });

        const operation: MatchResult["operation"] = {
          path: pathTemplate,
          method: opMethod,
          operationId: operationDef.operationId,
          summary: operationDef.summary,
          description: operationDef.description,
          pathParameters,
          queryParameters,
          headerParameters,
        };

        const errors = validateRequest(spec, operationDef, body, headers, queryParams);

        return { service, serverInfo, operation, errors };
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
                        const validation = validateParamValue(value, p.schema?.type || 'string', p.required ?? true);
                        return {
                          name: p.name,
                          type: p.schema?.type || "string",
                          required: p.required ?? true,
                          value,
                          isValid: validation.isValid,
                          validationReason: validation.reason,
                        };
                      });
                    
                    const queryParameters: ParameterInfo[] = parameters
                      .filter((p: any) => p.in === "query")
                      .map((p: any) => {
                        const queryParam = queryParams.find(qp => qp.enabled && qp.key.toLowerCase() === p.name.toLowerCase());
                        const value = queryParam?.value || null;
                        const validation = validateParamValue(value, p.schema?.type || 'string', p.required ?? false);
                        return {
                          name: p.name,
                          type: p.schema?.type || "string",
                          required: p.required ?? false,
                          value,
                          isValid: validation.isValid,
                          validationReason: validation.reason,
                        };
                      });

                    const headerParameters: ParameterInfo[] = parameters
                      .filter((p: any) => p.in === "header")
                      .map((p: any) => {
                        const headerParam = headers.find(h => h.enabled && h.key.toLowerCase() === p.name.toLowerCase());
                        const value = headerParam?.value || null;
                        const validation = validateParamValue(value, p.schema?.type || 'string', p.required ?? false);
                        return {
                          name: p.name,
                          type: p.schema?.type || "string",
                          required: p.required ?? false,
                          value,
                          isValid: validation.isValid,
                          validationReason: validation.reason,
                        };
                      });
                    
                    matchedOperation = {
                      path: pathTemplate,
                      method: method,
                      operationId: pathMethods[lowerMethod].operationId,
                      summary: pathMethods[lowerMethod].summary,
                      description: pathMethods[lowerMethod].description,
                      pathParameters,
                      queryParameters,
                      headerParameters,
                    };
                    
                    validationErrors = validateRequest(spec, pathMethods[lowerMethod], body, headers, queryParams);
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
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 bg-background"
                />
                <Button onClick={analyzeRequest} disabled={isAnalyzing}>
                  {isAnalyzing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Analyze
                    </>
                  )}
                </Button>
              </div>

              {/* Tabs for Params, Headers, Body */}
              <Tabs defaultValue="params" className="w-full">
                <TabsList className="w-full justify-start bg-muted/50">
                  <TabsTrigger value="params">Query Params</TabsTrigger>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                  <TabsTrigger value="body">Body</TabsTrigger>
                </TabsList>

                <TabsContent value="params" className="space-y-3 mt-4">
                  {queryParams.map((param, index) => (
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
                        className="flex-1 bg-background"
                      />
                      <Input
                        placeholder="Value"
                        value={param.value}
                        onChange={(e) => updateQueryParam(index, "value", e.target.value)}
                        className="flex-1 bg-background"
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
                  ))}
                  <Button variant="outline" size="sm" onClick={addQueryParam}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Parameter
                  </Button>
                </TabsContent>

                <TabsContent value="headers" className="space-y-3 mt-4">
                  {headers.map((header, index) => (
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
                        className="flex-1 bg-background"
                      />
                      <Input
                        placeholder="Value"
                        value={header.value}
                        onChange={(e) => updateHeader(index, "value", e.target.value)}
                        className="flex-1 bg-background"
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
                  ))}
                  <Button variant="outline" size="sm" onClick={addHeader}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Header
                  </Button>
                </TabsContent>

                <TabsContent value="body" className="mt-4">
                  <Textarea
                    placeholder='{"key": "value"}'
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="min-h-[300px] font-mono text-sm bg-background"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={50} minSize={30}>
            {/* Right Panel - Match Results */}
            <Card className="border-0 bg-card/50 h-full rounded-none overflow-auto">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-primary" />
                  OpenAPI Match Results
                </CardTitle>
                <Button
                  variant={isLocked ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsLocked(!isLocked)}
                  className="gap-2"
                >
                  {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  {isLocked ? "Locked" : "Auto"}
                </Button>
              </div>
              
              {/* Manual Selection Controls */}
              <div className="mt-4 space-y-3">
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
                    <label className="text-sm text-muted-foreground">Select Operation</label>
                    <Select 
                      value={selectedOperationKey || "__auto__"} 
                      onValueChange={(value) => setSelectedOperationKey(value === "__auto__" ? null : value)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Auto-detect from URL & method" />
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
                            <span className="font-mono text-sm">{op.path}</span>
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
            </CardHeader>
            <CardContent>
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
                                    <tr key={index} className="border-t border-border">
                                      <td className="px-3 py-2 text-foreground font-mono">{variable.name}</td>
                                      <td className="px-3 py-2">
                                        <code className="text-primary">{variable.value}</code>
                                        {variable.enum && variable.enum.length > 0 && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className="ml-2 text-xs text-muted-foreground cursor-help">(enum)</span>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Allowed values: {variable.enum.join(', ')}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-muted-foreground">
                                        {variable.description || <span className="italic">-</span>}
                                      </td>
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
                        Matched Operation
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
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            matchResult.operation?.method === "GET" ? "default" :
                            matchResult.operation?.method === "POST" ? "secondary" :
                            matchResult.operation?.method === "DELETE" ? "destructive" :
                            "outline"
                          }>
                            {matchResult.operation?.method}
                          </Badge>
                          <code className="text-sm text-foreground">{matchResult.operation?.path}</code>
                        </div>
                        {matchResult.operation?.operationId && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Operation ID:</span>{" "}
                            <span className="text-foreground">{matchResult.operation.operationId}</span>
                          </p>
                        )}
                        {matchResult.operation?.summary && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Summary:</span>{" "}
                            <span className="text-foreground">{matchResult.operation.summary}</span>
                          </p>
                        )}
                        {matchResult.operation?.description && (
                          <div className="space-y-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDescription(!showDescription)}
                              className="text-muted-foreground hover:text-foreground p-0 h-auto"
                            >
                              {showDescription ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  Hide Description
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  Show Description
                                </>
                              )}
                            </Button>
                            {showDescription && (
                              <div 
                                className="text-sm text-muted-foreground prose prose-sm prose-invert max-w-none [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-foreground [&_a]:text-primary [&_a]:underline"
                                dangerouslySetInnerHTML={{ __html: matchResult.operation.description }}
                              />
                            )}
                          </div>
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
                          <div className="rounded border border-border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <SortableHeader column="name" label="Name" currentSort={pathParamSort} onSort={(col) => handleSort(col, pathParamSort, setPathParamSort)} />
                                  <SortableHeader column="type" label="Type" currentSort={pathParamSort} onSort={(col) => handleSort(col, pathParamSort, setPathParamSort)} />
                                  <SortableHeader column="required" label="Required" currentSort={pathParamSort} onSort={(col) => handleSort(col, pathParamSort, setPathParamSort)} />
                                  <SortableHeader column="value" label="Value" currentSort={pathParamSort} onSort={(col) => handleSort(col, pathParamSort, setPathParamSort)} />
                                  <SortableHeader column="isValid" label="Valid" currentSort={pathParamSort} onSort={(col) => handleSort(col, pathParamSort, setPathParamSort)} />
                                </tr>
                              </thead>
                              <tbody>
                                {sortParameters(matchResult.operation.pathParameters, pathParamSort).map((param, index) => (
                                  <tr key={index} className="border-t border-border">
                                    <td className={`px-3 py-2 font-mono ${param.isValid ? 'text-foreground' : 'text-destructive'}`}>{param.name}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{param.type}</td>
                                    <td className="px-3 py-2">
                                      <Badge variant={param.required ? "destructive" : "secondary"} className="text-xs">
                                        {param.required ? "Required" : "Optional"}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2 text-foreground font-mono">
                                      {param.value || <span className="text-muted-foreground italic">-</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge 
                                              variant={param.isValid ? "default" : "destructive"} 
                                              className={`text-xs cursor-help ${param.isValid ? "bg-green-600 hover:bg-green-700" : ""}`}
                                            >
                                              {param.isValid ? "Valid" : "Invalid"}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>{param.validationReason}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </td>
                                  </tr>
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
                          <Route className="h-4 w-4" />
                          Query Parameters
                          <Badge variant="secondary" className="text-xs ml-1">
                            {matchResult.operation.queryParameters.length}
                          </Badge>
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
                          <div className="rounded border border-border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <SortableHeader column="name" label="Name" currentSort={queryParamSort} onSort={(col) => handleSort(col, queryParamSort, setQueryParamSort)} />
                                  <SortableHeader column="type" label="Type" currentSort={queryParamSort} onSort={(col) => handleSort(col, queryParamSort, setQueryParamSort)} />
                                  <SortableHeader column="required" label="Required" currentSort={queryParamSort} onSort={(col) => handleSort(col, queryParamSort, setQueryParamSort)} />
                                  <SortableHeader column="value" label="Value" currentSort={queryParamSort} onSort={(col) => handleSort(col, queryParamSort, setQueryParamSort)} />
                                  <SortableHeader column="isValid" label="Valid" currentSort={queryParamSort} onSort={(col) => handleSort(col, queryParamSort, setQueryParamSort)} />
                                </tr>
                              </thead>
                              <tbody>
                                {sortParameters(matchResult.operation.queryParameters, queryParamSort).map((param, index) => (
                                  <tr key={index} className="border-t border-border">
                                    <td className={`px-3 py-2 font-mono ${param.isValid ? 'text-foreground' : 'text-destructive'}`}>{param.name}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{param.type}</td>
                                    <td className="px-3 py-2">
                                      <Badge variant={param.required ? "destructive" : "secondary"} className="text-xs">
                                        {param.required ? "Required" : "Optional"}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2 text-foreground font-mono">
                                      {param.value || <span className="text-muted-foreground italic">-</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge 
                                              variant={param.isValid ? "default" : "destructive"} 
                                              className={`text-xs cursor-help ${param.isValid ? "bg-green-600 hover:bg-green-700" : ""}`}
                                            >
                                              {param.isValid ? "Valid" : "Invalid"}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>{param.validationReason}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </td>
                                  </tr>
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
                          <div className="rounded border border-border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <SortableHeader column="name" label="Name" currentSort={headerParamSort} onSort={(col) => handleSort(col, headerParamSort, setHeaderParamSort)} />
                                  <SortableHeader column="type" label="Type" currentSort={headerParamSort} onSort={(col) => handleSort(col, headerParamSort, setHeaderParamSort)} />
                                  <SortableHeader column="required" label="Required" currentSort={headerParamSort} onSort={(col) => handleSort(col, headerParamSort, setHeaderParamSort)} />
                                  <SortableHeader column="value" label="Value" currentSort={headerParamSort} onSort={(col) => handleSort(col, headerParamSort, setHeaderParamSort)} />
                                  <SortableHeader column="isValid" label="Valid" currentSort={headerParamSort} onSort={(col) => handleSort(col, headerParamSort, setHeaderParamSort)} />
                                </tr>
                              </thead>
                              <tbody>
                                {sortParameters(matchResult.operation.headerParameters, headerParamSort).map((param, index) => (
                                  <tr key={index} className="border-t border-border">
                                    <td className={`px-3 py-2 font-mono ${param.isValid ? 'text-foreground' : 'text-destructive'}`}>{param.name}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{param.type}</td>
                                    <td className="px-3 py-2">
                                      <Badge variant={param.required ? "destructive" : "secondary"} className="text-xs">
                                        {param.required ? "Required" : "Optional"}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2 text-foreground font-mono">
                                      {param.value || <span className="text-muted-foreground italic">-</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge 
                                              variant={param.isValid ? "default" : "destructive"} 
                                              className={`text-xs cursor-help ${param.isValid ? "bg-green-600 hover:bg-green-700" : ""}`}
                                            >
                                              {param.isValid ? "Valid" : "Invalid"}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>{param.validationReason}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
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
                      <div className="bg-background rounded-lg p-4 border border-border mt-2">
                        {matchResult.validationErrors.length === 0 ? (
                          <div className="flex items-center gap-2 text-success">
                            <CheckCircle className="h-4 w-4" />
                            <span>Request is valid</span>
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {matchResult.validationErrors.map((error, index) => (
                              <li key={index} className="flex items-start gap-2 text-destructive text-sm">
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                {error}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
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
