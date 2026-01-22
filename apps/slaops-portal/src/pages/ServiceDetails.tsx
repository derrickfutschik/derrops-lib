import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceApi, Configuration } from "@/client/slaops-cloud";
import { Service } from "@/client/slaops-cloud/models/service";
import { useToast } from "@/hooks/use-toast";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import yaml from "js-yaml";

const ServiceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [openapiSpec, setOpenapiSpec] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetchService();
  }, [id]);

  const fetchService = async () => {
    try {
      if (!id) {
        throw new Error("Service ID is required");
      }

      const API_BASE_URL = 'http://localhost:8080';
      const config = new Configuration({
        basePath: API_BASE_URL,
      });
      const serviceApi = new ServiceApi(config);

      const response = await serviceApi.serviceControllerFindOne(id);
      const data = response.data;

      setService(data);

      // Parse OpenAPI spec
      if (data.openapi_doc_content) {
        try {
          setOpenapiSpec(JSON.parse(data.openapi_doc_content));
        } catch (e) {
          console.error("Failed to parse OpenAPI content:", e);
        }
      } else if (data.openapi_doc_url) {
        // Fetch from URL
        try {
          const response = await fetch(data.openapi_doc_url);
          const contentType = response.headers.get("content-type") || "";
          const text = await response.text();

          // Try to determine if it's YAML or JSON
          let spec;
          if (contentType.includes("yaml") || contentType.includes("yml") ||
            data.openapi_doc_url.endsWith(".yaml") || data.openapi_doc_url.endsWith(".yml") ||
            text.trim().startsWith("openapi:")) {
            // Parse as YAML
            spec = yaml.load(text);
          } else {
            // Parse as JSON
            spec = JSON.parse(text);
          }

          setOpenapiSpec(spec);
        } catch (e) {
          console.error("Failed to fetch OpenAPI spec from URL:", e);
          toast({
            title: "Error loading API documentation",
            description: "Failed to load the OpenAPI specification. Please check the URL.",
            variant: "destructive",
          });
        }
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load service",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading service details...</div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Service not found</h2>
          <Button onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const getAvailabilityStatus = (availability: number | null) => {
    if (!availability) return { label: "Unknown", variant: "secondary" as const };
    if (availability >= 99.9) return { label: "Excellent", variant: "default" as const };
    if (availability >= 99.0) return { label: "Good", variant: "secondary" as const };
    return { label: "Poor", variant: "destructive" as const };
  };

  const getResponseTimeStatus = (responseTime: number | null) => {
    if (!responseTime) return { label: "Unknown", variant: "secondary" as const };
    if (responseTime < 200) return { label: "Fast", variant: "default" as const };
    if (responseTime < 500) return { label: "Normal", variant: "secondary" as const };
    return { label: "Slow", variant: "destructive" as const };
  };

  const availabilityStatus = getAvailabilityStatus(service.availability);
  const responseTimeStatus = getResponseTimeStatus(service.response_time);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        {/* High-level Overview */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{service.name}</h1>
              {service.endpoint && (
                <p className="text-muted-foreground font-mono text-sm">{service.endpoint}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Availability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold">
                    {service.availability ? `${service.availability}%` : "N/A"}
                  </div>
                  <Badge variant={availabilityStatus.variant}>
                    {availabilityStatus.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold">
                    {service.response_time ? `${service.response_time}ms` : "N/A"}
                  </div>
                  <Badge variant={responseTimeStatus.variant}>
                    {responseTimeStatus.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Uptime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">99.98%</div>
                <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  Error Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0.02%</div>
                <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="api" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="api">API Documentation</TabsTrigger>
            <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
            <TabsTrigger value="logs">Activity Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="space-y-4">
            {openapiSpec ? (
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
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No API Documentation</h3>
                  <p className="text-muted-foreground mb-4">
                    No OpenAPI specification has been uploaded for this service.
                  </p>
                  <Button onClick={() => navigate(`/edit-service/${service.id}`)}>
                    Add Documentation
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="metrics">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Request Volume</h4>
                    <div className="h-48 flex items-center justify-center border border-border rounded-lg bg-muted/20">
                      <p className="text-muted-foreground">Chart coming soon</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Response Time Trends</h4>
                    <div className="h-48 flex items-center justify-center border border-border rounded-lg bg-muted/20">
                      <p className="text-muted-foreground">Chart coming soon</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Activity Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">No activity logs yet. Logs will appear here once SDK integration is complete.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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
    </div>
  );
};

export default ServiceDetails;
