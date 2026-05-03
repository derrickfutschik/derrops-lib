import { Service } from '@/client/derrops-cloud/models/service'
import { OpenAPIFormValues } from '@/components/derrops-client/OpenAPIParameterForm'
import { OpenAPISelection } from '@/components/derrops-client/OpenAPISelection'

interface OpenAPIParametersPanelProps {
  services: Service[]
  openAPIServiceId: string | null
  openAPIOperationKey: string | null
  openAPIServerUrl: string
  openAPIFormValues: OpenAPIFormValues
  onOpenAPIServiceIdChange: (id: string | null) => void
  onOpenAPIOperationKeyChange: (key: string | null) => void
  onOpenAPIServerUrlChange: (url: string) => void
  onOpenAPIFormValuesChange: (values: OpenAPIFormValues) => void
  onOpenAPIOperationParsed: (operation: any) => void
  onOpenAPISpecParsed: (spec: any) => void
}

export function OpenAPIParametersPanel({
  services,
  openAPIServiceId,
  openAPIOperationKey,
  openAPIServerUrl,
  openAPIFormValues,
  onOpenAPIServiceIdChange,
  onOpenAPIOperationKeyChange,
  onOpenAPIServerUrlChange,
  onOpenAPIFormValuesChange,
  onOpenAPIOperationParsed,
  onOpenAPISpecParsed,
}: OpenAPIParametersPanelProps) {
  return (
    <OpenAPISelection
      services={services}
      selectedServiceId={openAPIServiceId}
      selectedOperationKey={openAPIOperationKey}
      serverUrl={openAPIServerUrl}
      formValues={openAPIFormValues}
      onServiceChange={onOpenAPIServiceIdChange}
      onOperationChange={onOpenAPIOperationKeyChange}
      onServerUrlChange={onOpenAPIServerUrlChange}
      onFormValuesChange={onOpenAPIFormValuesChange}
      onOperationParsed={onOpenAPIOperationParsed}
      onSpecParsed={onOpenAPISpecParsed}
    />
  )
}
