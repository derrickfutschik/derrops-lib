import { ServiceApi } from '@/client/slaops-cloud'
import { Service } from '@/client/slaops-cloud/models/service'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'
import yaml from 'js-yaml'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ActivityLogsTab from './ActivityLogsTab'
import ApiDocumentationTab from './ApiDocumentationTab'
import MetricsTab from './MetricsTab'
import ServiceMetricsGrid from './ServiceMetricsGrid'

const ServiceDetails = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [openapiSpec, setOpenapiSpec] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    fetchService()
  }, [id])

  const fetchService = async () => {
    try {
      if (!id) {
        throw new Error('Service ID is required')
      }

      const serviceApi = new ServiceApi(cloudApiConfig, undefined, cloudAxios)
      const response = await serviceApi.serviceControllerFindOne(id)
      const data = response.data

      setService(data)
      await loadOpenapiSpec(data)
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load service',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadOpenapiSpec = async (data: Service) => {
    if (data.openapi_doc_content) {
      try {
        setOpenapiSpec(JSON.parse(data.openapi_doc_content))
      } catch (e) {
        console.error('Failed to parse OpenAPI content:', e)
      }
      return
    }

    if (!data.openapi_doc_url) return

    try {
      const res = await fetch(data.openapi_doc_url)
      const contentType = res.headers.get('content-type') || ''
      const text = await res.text()

      const isYaml =
        contentType.includes('yaml') ||
        contentType.includes('yml') ||
        data.openapi_doc_url.endsWith('.yaml') ||
        data.openapi_doc_url.endsWith('.yml') ||
        text.trim().startsWith('openapi:')

      setOpenapiSpec(isYaml ? (yaml.load(text) as Record<string, unknown>) : JSON.parse(text))
    } catch (e) {
      console.error('Failed to fetch OpenAPI spec from URL:', e)
      toast({
        title: 'Error loading API documentation',
        description: 'Failed to load the OpenAPI specification. Please check the URL.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading service details...</div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Service not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{service.name}</h1>
              {service.endpoint && (
                <p className="text-muted-foreground font-mono text-sm">{service.endpoint}</p>
              )}
            </div>
          </div>
          <ServiceMetricsGrid service={service} />
        </div>

        <Tabs defaultValue="api" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="api">API Documentation</TabsTrigger>
            <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
            <TabsTrigger value="logs">Activity Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="space-y-4">
            <ApiDocumentationTab openapiSpec={openapiSpec} serviceId={service.id} />
          </TabsContent>

          <TabsContent value="metrics">
            <MetricsTab />
          </TabsContent>

          <TabsContent value="logs">
            <ActivityLogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default ServiceDetails
