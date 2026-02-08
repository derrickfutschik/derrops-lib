import { Service } from '@/client/slaops-cloud/models/service'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import yaml from 'js-yaml'
import { AlertCircle, FileCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { OpenAPIFormValues, OpenAPIParameterForm } from './OpenAPIParameterForm'

interface OperationOption {
  key: string // "method:path"
  method: string
  path: string
  operationId?: string
  summary?: string
}

interface OpenAPIRequestTabProps {
  services: Service[]
  selectedServiceId: string | null
  selectedOperationKey: string | null
  formValues: OpenAPIFormValues
  onServiceChange: (serviceId: string | null) => void
  onOperationChange: (operationKey: string | null) => void
  onFormValuesChange: (values: OpenAPIFormValues) => void
  onOperationParsed: (operation: any) => void
}

/**
 * Main OpenAPI request tab component with service/operation selection
 */
export function OpenAPIRequestTab({
  services,
  selectedServiceId,
  selectedOperationKey,
  formValues,
  onServiceChange,
  onOperationChange,
  onFormValuesChange,
  onOperationParsed,
}: OpenAPIRequestTabProps) {
  const [spec, setSpec] = useState<any>(null)
  const [operations, setOperations] = useState<OperationOption[]>([])
  const [currentOperation, setCurrentOperation] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Parse OpenAPI spec when service changes
  useEffect(() => {
    if (!selectedServiceId) {
      setSpec(null)
      setOperations([])
      setCurrentOperation(null)
      onOperationParsed(null)
      return
    }

    const service = services.find((s) => s.id === selectedServiceId)
    if (!service) return

    const loadSpec = async () => {
      setLoading(true)
      setError(null)

      try {
        let specContent = ''

        // Check if spec is stored directly
        if (service.openapi_doc_content) {
          specContent = service.openapi_doc_content
        } else if (service.openapi_doc_url) {
          // Fetch from URL
          const response = await fetch(service.openapi_doc_url)
          if (!response.ok) {
            throw new Error(`Failed to fetch spec: ${response.statusText}`)
          }
          specContent = await response.text()
        } else {
          throw new Error('No OpenAPI spec URL or content available')
        }

        // Parse YAML or JSON
        let parsedSpec: any
        try {
          parsedSpec = yaml.load(specContent)
        } catch (yamlError) {
          // Try JSON parsing
          try {
            parsedSpec = JSON.parse(specContent)
          } catch (jsonError) {
            throw new Error('Failed to parse spec as YAML or JSON')
          }
        }

        setSpec(parsedSpec)

        // Extract operations
        const ops = extractOperations(parsedSpec)
        setOperations(ops)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load OpenAPI spec')
        setSpec(null)
        setOperations([])
      } finally {
        setLoading(false)
      }
    }

    loadSpec()
  }, [selectedServiceId, services])

  // Update current operation when selection changes
  useEffect(() => {
    if (!selectedOperationKey || !spec) {
      setCurrentOperation(null)
      onOperationParsed(null)
      return
    }

    const [method, path] = selectedOperationKey.split(':')
    const pathItem = spec.paths?.[path]
    if (!pathItem) {
      setCurrentOperation(null)
      onOperationParsed(null)
      return
    }

    const operation = pathItem[method.toLowerCase()]
    if (!operation) {
      setCurrentOperation(null)
      onOperationParsed(null)
      return
    }

    const enrichedOperation = {
      ...operation,
      method: method.toUpperCase(),
      path,
    }

    setCurrentOperation(enrichedOperation)
    onOperationParsed(enrichedOperation)
  }, [selectedOperationKey, spec, onOperationParsed])

  // Extract operations from OpenAPI spec
  const extractOperations = (spec: any): OperationOption[] => {
    const ops: OperationOption[] = []
    const paths = spec.paths || {}

    Object.entries(paths).forEach(([path, pathItem]: [string, any]) => {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
      methods.forEach((method) => {
        if (pathItem[method]) {
          const operation = pathItem[method]
          ops.push({
            key: `${method.toUpperCase()}:${path}`,
            method: method.toUpperCase(),
            path,
            operationId: operation.operationId,
            summary: operation.summary,
          })
        }
      })
    })

    return ops
  }

  // Get HTTP method color
  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-blue-500'
      case 'POST':
        return 'bg-green-500'
      case 'PUT':
        return 'bg-orange-500'
      case 'PATCH':
        return 'bg-yellow-500'
      case 'DELETE':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-4">
      {/* Service Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">API Service</label>
        <Select value={selectedServiceId || ''} onValueChange={onServiceChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select an API service..." />
          </SelectTrigger>
          <SelectContent>
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

      {/* Operation Selection */}
      {selectedServiceId && spec && !loading && !error && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Operation</label>
            <Select value={selectedOperationKey || ''} onValueChange={onOperationChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an operation..." />
              </SelectTrigger>
              <SelectContent>
                {operations.map((op) => (
                  <SelectItem key={op.key} value={op.key}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{op.method}</span>
                      <span className="font-mono text-sm">{op.path}</span>
                      {op.summary && (
                        <span className="text-muted-foreground text-sm">- {op.summary}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operation Display */}
          {currentOperation && (
            <Card className="border-2">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={getMethodColor(currentOperation.method)}>
                    {currentOperation.method}
                  </Badge>
                  <code className="flex-1 text-sm font-mono bg-muted px-3 py-1.5 rounded">
                    {currentOperation.path}
                  </code>
                </div>

                {currentOperation.summary && (
                  <>
                    <Separator />
                    <div className="text-sm">
                      <span className="font-medium">Summary: </span>
                      <span className="text-muted-foreground">{currentOperation.summary}</span>
                    </div>
                  </>
                )}

                {currentOperation.description && (
                  <div className="text-sm">
                    <span className="font-medium">Description: </span>
                    <span className="text-muted-foreground">{currentOperation.description}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Parameter Form */}
          {currentOperation && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Parameters</h3>
                <OpenAPIParameterForm
                  operation={currentOperation}
                  values={formValues}
                  onChange={onFormValuesChange}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* Empty State */}
      {!selectedServiceId && (
        <Alert>
          <FileCode className="h-4 w-4" />
          <AlertDescription>Select an API service to begin building your request</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
