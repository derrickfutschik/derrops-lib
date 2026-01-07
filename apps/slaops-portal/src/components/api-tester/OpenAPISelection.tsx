import { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, FileCode, HelpCircle } from "lucide-react";
import { OpenAPIParameterForm, OpenAPIFormValues } from "./OpenAPIParameterForm";
import { Service } from "@/client/slaops-cloud/models/service";
import yaml from "js-yaml";

interface OperationOption {
  key: string; // "method:path"
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
}

interface OpenAPISelectionProps {
  services: Service[];
  selectedServiceId: string | null;
  selectedOperationKey: string | null;
  serverUrl: string;
  formValues: OpenAPIFormValues;
  onServiceChange: (serviceId: string | null) => void;
  onOperationChange: (operationKey: string | null) => void;
  onServerUrlChange: (url: string) => void;
  onFormValuesChange: (values: OpenAPIFormValues) => void;
  onOperationParsed: (operation: any) => void;
  onSpecParsed?: (spec: any) => void;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const getByJsonPointer = (root: any, ref: string) => {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return undefined;
  const path = ref.slice(2).split("/").map((seg) => seg.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur: any = root;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[key];
  }
  return cur;
};

const resolveRef = (root: any, value: any, seen = new Set<string>()): any => {
  if (!value || typeof value !== "object") return value;
  const ref = (value as any).$ref;
  if (typeof ref !== "string") return value;
  if (seen.has(ref)) return value;
  seen.add(ref);
  const resolved = getByJsonPointer(root, ref);
  if (!resolved) return value;
  return resolveRef(root, resolved, seen);
};

const inferPathParamNames = (path: string): string[] => {
  const matches = path.match(/\{([^}]+)\}/g) || [];
  return matches.map((m) => m.slice(1, -1)).filter(Boolean);
};

export function OpenAPISelection({
  services,
  selectedServiceId,
  selectedOperationKey,
  serverUrl,
  formValues,
  onServiceChange,
  onOperationChange,
  onServerUrlChange,
  onFormValuesChange,
  onOperationParsed,
  onSpecParsed,
}: OpenAPISelectionProps) {
  const [spec, setSpec] = useState<any>(null);
  const [operations, setOperations] = useState<OperationOption[]>([]);
  const [currentOperation, setCurrentOperation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servers, setServers] = useState<string[]>([]);
  const lastSelectedServiceIdRef = useRef<string | null>(null);

  // Parse OpenAPI spec when service changes
  useEffect(() => {
    const isServiceSwitch = selectedServiceId !== lastSelectedServiceIdRef.current;

    // When switching API Service, clear any previous Server URL so it can be re-populated from the new spec.
    if (isServiceSwitch) {
      onServerUrlChange("");
      lastSelectedServiceIdRef.current = selectedServiceId;
    }

    if (!selectedServiceId) {
      setSpec(null);
      setOperations([]);
      setCurrentOperation(null);
      setServers([]);
      onOperationParsed(null);
      onSpecParsed?.(null);
      return;
    }

    const service = services.find((s) => s.id === selectedServiceId);
    if (!service) return;

    const loadSpec = async () => {
      setLoading(true);
      setError(null);

      try {
        let specContent = "";

        if (service.openapi_doc_content) {
          specContent = service.openapi_doc_content;
        } else if (service.openapi_doc_url) {
          const response = await fetch(service.openapi_doc_url);
          if (!response.ok) {
            throw new Error(`Failed to fetch spec: ${response.statusText}`);
          }
          specContent = await response.text();
        } else {
          throw new Error("No OpenAPI spec URL or content available");
        }

        let parsedSpec: any;
        try {
          parsedSpec = yaml.load(specContent);
        } catch (yamlError) {
          try {
            parsedSpec = JSON.parse(specContent);
          } catch (jsonError) {
            throw new Error("Failed to parse spec as YAML or JSON");
          }
        }

        setSpec(parsedSpec);
        onSpecParsed?.(parsedSpec);

        // Extract servers (OpenAPI supports servers at root, path, and operation levels)
        const specServerSet = new Set<string>();

        const addServersFrom = (serversValue: any) => {
          if (!Array.isArray(serversValue)) return;
          serversValue.forEach((server: any) => {
            if (server?.url && typeof server.url === "string") {
              specServerSet.add(server.url);
            }
          });
        };

        // 1) Root-level servers
        addServersFrom(parsedSpec.servers);

        // 2) Fallback: Path-level / Operation-level servers (e.g., Open-Meteo)
        if (specServerSet.size === 0 && parsedSpec.paths && typeof parsedSpec.paths === "object") {
          Object.values(parsedSpec.paths).forEach((pathItem: any) => {
            if (!pathItem || typeof pathItem !== "object") return;

            addServersFrom(pathItem.servers);

            Object.values(pathItem).forEach((maybeOperation: any) => {
              if (!maybeOperation || typeof maybeOperation !== "object") return;
              addServersFrom(maybeOperation.servers);
            });
          });
        }

        const specServers = Array.from(specServerSet);
        setServers(specServers);

        // Auto-populate server URL only if exactly 1 server and no variables in URL.
        // Re-populates on API Service switch.
        if (specServers.length === 1) {
          const onlyServerUrl = specServers[0];
          const hasVariables = /\{[^}]+\}/.test(onlyServerUrl);
          if (!hasVariables && (isServiceSwitch || !serverUrl)) {
            onServerUrlChange(onlyServerUrl);
          }
        }

        // Extract operations
        const ops = extractOperations(parsedSpec);
        setOperations(ops);

        // Auto-select operation if exactly 1 operation exists
        if (ops.length === 1 && isServiceSwitch) {
          onOperationChange(ops[0].key);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load OpenAPI spec");
        setSpec(null);
        setOperations([]);
        setServers([]);
      } finally {
        setLoading(false);
      }
    };

    loadSpec();
  }, [selectedServiceId, services, onOperationParsed, onOperationChange, onServerUrlChange, onSpecParsed]);

  // Update current operation when selection changes
  useEffect(() => {
    if (!selectedOperationKey || !spec) {
      setCurrentOperation(null);
      onOperationParsed(null);
      return;
    }

    const [method, ...pathParts] = selectedOperationKey.split(":");
    const path = pathParts.join(":");

    const rawPathItem = spec.paths?.[path];
    const pathItem = resolveRef(spec, rawPathItem);
    if (!pathItem) {
      setCurrentOperation(null);
      onOperationParsed(null);
      return;
    }

    const rawOperation = pathItem[method.toLowerCase()];
    const operation = resolveRef(spec, rawOperation);
    if (!operation) {
      setCurrentOperation(null);
      onOperationParsed(null);
      return;
    }

    // Merge path-level and operation-level parameters (OpenAPI allows both)
    // Resolve $ref entries (common in large specs like GitHub)
    const pathLevelParamsRaw = pathItem.parameters || [];
    const operationLevelParamsRaw = operation.parameters || [];

    const pathLevelParams = (Array.isArray(pathLevelParamsRaw) ? pathLevelParamsRaw : []).map((p: any) => resolveRef(spec, p));
    const operationLevelParams = (Array.isArray(operationLevelParamsRaw) ? operationLevelParamsRaw : []).map((p: any) => resolveRef(spec, p));

    // Operation-level params override path-level params with the same name+in
    const mergedParams: any[] = [...pathLevelParams];
    operationLevelParams.forEach((opParam: any) => {
      const existingIndex = mergedParams.findIndex(
        (p: any) => p?.name === opParam?.name && p?.in === opParam?.in
      );
      if (existingIndex >= 0) {
        mergedParams[existingIndex] = opParam; // Override
      } else {
        mergedParams.push(opParam);
      }
    });

    // Fallback: if the path includes {param} placeholders but the spec parameters are missing/refs unresolved,
    // infer them so the user can still provide values.
    const placeholderNames = inferPathParamNames(path);
    placeholderNames.forEach((name) => {
      const alreadyDefined = mergedParams.some((p: any) => p?.in === "path" && p?.name === name);
      if (!alreadyDefined) {
        mergedParams.push({
          name,
          in: "path",
          required: true,
          schema: { type: "string" },
        });
      }
    });

    const enrichedOperation = {
      ...operation,
      method: method.toUpperCase(),
      path,
      parameters: mergedParams,
    };

    setCurrentOperation(enrichedOperation);
    onOperationParsed(enrichedOperation);
  }, [selectedOperationKey, spec, onOperationParsed]);

  const extractOperations = (spec: any): OperationOption[] => {
    const ops: OperationOption[] = [];
    const paths = spec.paths || {};

    Object.entries(paths).forEach(([path, pathItem]: [string, any]) => {
      HTTP_METHODS.forEach((method) => {
        const lowerMethod = method.toLowerCase();
        if (pathItem[lowerMethod]) {
          const operation = pathItem[lowerMethod];
          ops.push({
            key: `${method}:${path}`,
            method,
            path,
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
          });
        }
      });
    });

    return ops;
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "text-green-500";
      case "POST":
        return "text-yellow-500";
      case "PUT":
        return "text-blue-500";
      case "PATCH":
        return "text-purple-500";
      case "DELETE":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  // Build the full request URL
  const getRequestUrl = (): string => {
    if (!currentOperation || !serverUrl) return "";
    
    let fullPath = currentOperation.path;
    
    // Replace path parameters with form values
    if (formValues.pathParams) {
      Object.entries(formValues.pathParams).forEach(([key, value]) => {
        fullPath = fullPath.replace(`{${key}}`, String(value || `{${key}}`));
      });
    }
    
    // Build query string
    const queryParts: string[] = [];
    if (formValues.queryParams) {
      Object.entries(formValues.queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
      });
    }
    
    const baseUrl = serverUrl.replace(/\/$/, "");
    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    
    return `${baseUrl}${fullPath}${queryString}`;
  };

  return (
    <div className="space-y-4">
      {/* Service Selection */}
      <div className="space-y-2">
        <label className={`text-sm font-medium ${selectedServiceId ? "text-muted-foreground" : "text-destructive"}`}>API Service</label>
        <Select value={selectedServiceId || ""} onValueChange={(v) => onServiceChange(v || null)}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select an API service..." />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {loading && (
        <Alert>
          <FileCode className="h-4 w-4" />
          <AlertDescription>Loading OpenAPI specification...</AlertDescription>
        </Alert>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Server URL */}
      {selectedServiceId && spec && !loading && !error && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Server URL</label>
            <Input
              placeholder="Enter server URL (e.g., https://api.example.com)"
              value={serverUrl}
              onChange={(e) => onServerUrlChange(e.target.value)}
              className="bg-background"
              list="server-url-suggestions"
            />
            {servers.length > 0 && (
              <datalist id="server-url-suggestions">
                {servers.map((server, idx) => (
                  <option key={idx} value={server} />
                ))}
              </datalist>
            )}
          </div>

          {/* Operation Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Operation
              {selectedOperationKey && (() => {
                const op = operations.find((o) => o.key === selectedOperationKey);
                return (op?.summary || op?.description) ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </PopoverTrigger>
                    <PopoverContent side="top" className="max-w-xs text-sm p-3">
                      {op.summary && <p className="font-medium">{op.summary}</p>}
                      {op.summary && op.description && <br />}
                      {op.description && <p>{op.description}</p>}
                    </PopoverContent>
                  </Popover>
                ) : null;
              })()}
            </label>
            <Select value={selectedOperationKey || ""} onValueChange={(v) => onOperationChange(v || null)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select an operation...">
                  {selectedOperationKey && (() => {
                    const op = operations.find((o) => o.key === selectedOperationKey);
                    return op ? (
                      <span className="flex items-center gap-2">
                        <span className={`font-mono font-semibold ${getMethodColor(op.method)}`}>
                          {op.method}
                        </span>
                        <span className="font-mono text-sm">{op.path}</span>
                      </span>
                    ) : null;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover z-50 max-h-[300px]">
                {operations.map((op) => (
                  <SelectItem key={op.key} value={op.key}>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-semibold ${getMethodColor(op.method)}`}>
                        {op.method}
                      </span>
                      <span className="font-mono text-sm">{op.path}</span>
                      {op.summary && (
                        <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                          - {op.summary}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parameter Form */}
          {currentOperation && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-medium text-muted-foreground">Parameters</h3>
              <OpenAPIParameterForm
                operation={currentOperation}
                values={formValues}
                onChange={onFormValuesChange}
              />
            </div>
          )}
        </>
      )}

    </div>
  );
}
