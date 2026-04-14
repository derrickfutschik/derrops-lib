import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

interface ApiDocumentationTabProps {
  openapiSpec: Record<string, unknown> | null
  serviceId: string
}

const ApiDocumentationTab = ({ openapiSpec, serviceId }: ApiDocumentationTabProps) => {
  const navigate = useNavigate()

  if (openapiSpec) {
    return (
      <>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="swagger-ui-wrapper">
              <SwaggerUI
                spec={openapiSpec}
                docExpansion="list"
                defaultModelsExpandDepth={1}
                defaultModelExpandDepth={1}
              />
            </div>
          </CardContent>
        </Card>
        <SwaggerThemeOverride />
      </>
    )
  }

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No API Documentation</h3>
        <p className="text-muted-foreground mb-4">
          No OpenAPI specification has been uploaded for this service.
        </p>
        <Button onClick={() => navigate(`/edit-service/${serviceId}`)}>Add Documentation</Button>
      </CardContent>
    </Card>
  )
}

const SwaggerThemeOverride = () => (
  <style>{`
    .swagger-ui-wrapper .swagger-ui {
      font-family: inherit;
      color: hsl(var(--foreground));
    }
    .swagger-ui .topbar {
      display: none;
    }
    .swagger-ui .info,
    .swagger-ui .info *,
    .swagger-ui .scheme-container,
    .swagger-ui .scheme-container * {
      color: hsl(var(--foreground)) !important;
    }
    .swagger-ui .info .title,
    .swagger-ui .info h1,
    .swagger-ui .info h2,
    .swagger-ui .info h3,
    .swagger-ui .info h4,
    .swagger-ui .info h5 {
      color: hsl(var(--foreground)) !important;
    }
    .swagger-ui .information-container {
      background: transparent;
    }
    .swagger-ui .scheme-container {
      background: transparent;
      box-shadow: none;
    }
    .swagger-ui .opblock-tag {
      border-bottom: 1px solid hsl(var(--border));
      color: hsl(var(--foreground));
    }
    .swagger-ui .opblock-tag-section h3,
    .swagger-ui .opblock-tag-section h4 {
      color: hsl(var(--foreground)) !important;
    }
    .swagger-ui .opblock {
      border: 1px solid hsl(var(--border));
      background: hsl(var(--card));
      margin-bottom: 1rem;
      color: hsl(var(--foreground));
    }
    .swagger-ui .opblock .opblock-summary {
      border-color: hsl(var(--border));
    }
    .swagger-ui .opblock-summary-method,
    .swagger-ui .opblock-summary-path,
    .swagger-ui .opblock-summary-description {
      color: hsl(var(--foreground)) !important;
    }
    .swagger-ui .opblock.opblock-get .opblock-summary {
      background: hsl(var(--primary) / 0.1);
      border-color: hsl(var(--primary));
    }
    .swagger-ui .opblock.opblock-post .opblock-summary {
      background: hsl(142 76% 36% / 0.1);
      border-color: hsl(142 76% 36%);
    }
    .swagger-ui .opblock.opblock-put .opblock-summary {
      background: hsl(45 93% 47% / 0.1);
      border-color: hsl(45 93% 47%);
    }
    .swagger-ui .opblock.opblock-delete .opblock-summary {
      background: hsl(var(--destructive) / 0.1);
      border-color: hsl(var(--destructive));
    }
    .swagger-ui .opblock-body,
    .swagger-ui .opblock-description-wrapper,
    .swagger-ui .opblock-description,
    .swagger-ui .parameter__name,
    .swagger-ui .parameter__type,
    .swagger-ui .parameter__deprecated,
    .swagger-ui .parameter__in,
    .swagger-ui .response-col_description,
    .swagger-ui .tab li,
    .swagger-ui label,
    .swagger-ui .prop-name,
    .swagger-ui .prop-format {
      color: hsl(var(--foreground)) !important;
    }
    .swagger-ui .btn {
      background: hsl(var(--primary));
      color: hsl(var(--primary-foreground));
      border-color: hsl(var(--primary));
    }
    .swagger-ui .btn:hover {
      background: hsl(var(--primary) / 0.9);
    }
    .swagger-ui textarea,
    .swagger-ui input[type="text"],
    .swagger-ui input[type="password"],
    .swagger-ui select {
      background: hsl(var(--background));
      color: hsl(var(--foreground)) !important;
      border: 1px solid hsl(var(--border));
    }
    .swagger-ui .response-col_status {
      color: hsl(var(--foreground));
    }
    .swagger-ui .response-col_description {
      color: hsl(var(--foreground));
    }
    .swagger-ui table thead tr th,
    .swagger-ui table thead tr td,
    .swagger-ui table tbody tr td {
      color: hsl(var(--foreground)) !important;
      border-color: hsl(var(--border));
    }
    .swagger-ui .model-box {
      background: hsl(var(--card));
    }
    .swagger-ui section.models {
      border-color: hsl(var(--border));
    }
    .swagger-ui .model-toggle::after {
      background: hsl(var(--muted));
    }
    .swagger-ui .model,
    .swagger-ui .model-title {
      color: hsl(var(--foreground)) !important;
    }
    .swagger-ui .prop-type {
      color: hsl(var(--primary));
    }
    .swagger-ui .markdown p,
    .swagger-ui .markdown code,
    .swagger-ui .renderedMarkdown p,
    .swagger-ui .renderedMarkdown code {
      color: hsl(var(--foreground)) !important;
    }
  `}</style>
)

export default ApiDocumentationTab
