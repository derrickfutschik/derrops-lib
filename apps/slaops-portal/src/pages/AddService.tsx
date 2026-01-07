import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Zap } from "lucide-react";
import { ServicesApi, Configuration } from "@/client/slaops-cloud";
import type { CreateServiceDto } from "@/client/slaops-cloud";
import { useToast } from "@/hooks/use-toast";

const exampleServices = [
  {
    name: "AWS S3",
    openapi_doc_url: "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/amazonaws.com/s3/2006-03-01/openapi.yaml",
    openapi_doc_content: "",
    endpoint: "https://s3.amazonaws.com",
    availability: "99.99",
    response_time: "45",
  },
  {
    name: "Stripe API",
    openapi_doc_url: "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
    openapi_doc_content: "",
    endpoint: "https://api.stripe.com/v1",
    availability: "99.95",
    response_time: "120",
  },
  {
    name: "Twilio API",
    openapi_doc_url: "https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json",
    openapi_doc_content: "",
    endpoint: "https://api.twilio.com",
    availability: "99.97",
    response_time: "95",
  },
  {
    name: "SendGrid API",
    openapi_doc_url: "https://raw.githubusercontent.com/sendgrid/sendgrid-oai/main/oai.json",
    openapi_doc_content: "",
    endpoint: "https://api.sendgrid.com/v3",
    availability: "99.98",
    response_time: "80",
  },
  {
    name: "GitHub API",
    openapi_doc_url: "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
    openapi_doc_content: "",
    endpoint: "https://api.github.com",
    availability: "99.96",
    response_time: "110",
  },
  {
    name: "Open-Meteo API",
    openapi_doc_url: "https://open-meteo.com/docs/openapi.yml",
    openapi_doc_content: "",
    endpoint: "https://api.open-meteo.com/v1",
    availability: "99.95",
    response_time: "150",
  },
];

const AddService = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    openapi_doc_url: "",
    openapi_doc_content: "",
    endpoint: "",
    availability: "",
    response_time: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: Replace with actual user authentication
      // For now, using a hardcoded user_id
      const user_id = "5c963787-d89d-4260-adaf-6541c41cb982";

      const API_BASE_URL = 'http://localhost:8083';
      const config = new Configuration({
        basePath: API_BASE_URL,
      });
      const servicesApi = new ServicesApi(config);

      const createDto: CreateServiceDto = {
        user_id,
        name: formData.name,
        endpoint: formData.endpoint || '',
        openapi_doc_url: formData.openapi_doc_url || undefined,
        openapi_doc_content: formData.openapi_doc_content || undefined,
        availability: formData.availability ? parseFloat(formData.availability) : undefined,
        response_time: formData.response_time ? parseInt(formData.response_time) : undefined,
      };

      await servicesApi.servicesControllerCreate(createDto);

      toast({
        title: "Success",
        description: "Service added successfully",
      });

      navigate("/dashboard");
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add service",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick Start Examples
            </CardTitle>
            <CardDescription>
              Click any example to auto-fill the form with popular SAAS services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {exampleServices.map((service) => (
                <Button
                  key={service.name}
                  variant="outline"
                  className="h-auto py-4 px-4 flex flex-col items-start gap-1 hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => setFormData(service)}
                  type="button"
                >
                  <span className="font-semibold">{service.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {service.availability}% uptime • {service.response_time}ms
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add New SAAS Application</CardTitle>
            <CardDescription>
              Manually add a SAAS application to monitor its performance and availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Service Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Stripe API, Twilio, SendGrid"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openapi_doc_url">OpenAPI Documentation URL</Label>
                <Input
                  id="openapi_doc_url"
                  type="url"
                  value={formData.openapi_doc_url}
                  onChange={(e) => setFormData({ ...formData, openapi_doc_url: e.target.value })}
                  placeholder="https://api.example.com/openapi.json"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openapi_doc_content">OpenAPI Documentation (Paste Content)</Label>
                <Textarea
                  id="openapi_doc_content"
                  value={formData.openapi_doc_content}
                  onChange={(e) => setFormData({ ...formData, openapi_doc_content: e.target.value })}
                  placeholder="Paste your OpenAPI specification here..."
                  className="min-h-[120px] font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endpoint">API Endpoint (Optional)</Label>
                <Input
                  id="endpoint"
                  type="url"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="availability">Availability (%)</Label>
                  <Input
                    id="availability"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.availability}
                    onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                    placeholder="99.99"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="response_time">Response Time (ms)</Label>
                  <Input
                    id="response_time"
                    type="number"
                    min="0"
                    value={formData.response_time}
                    onChange={(e) => setFormData({ ...formData, response_time: e.target.value })}
                    placeholder="250"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Service"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddService;
