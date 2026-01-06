import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp } from "lucide-react";
import { ServicesApi, Configuration } from "@/client/slaops-cloud";
import { useToast } from "@/hooks/use-toast";

interface Service {
  id: string;
  name: string;
  endpoint: string | null;
  availability: number | null;
  response_time: number | null;
}

const ServicesList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const API_BASE_URL = 'http://localhost:8083';
      const config = new Configuration({
        basePath: API_BASE_URL,
      });
      const servicesApi = new ServicesApi(config);
      
      const response = await servicesApi.servicesControllerFindAll("id,name,endpoint,availability,response_time");
      const data = response.data as any[];

      // Map API Service to local Service format
      const mappedServices: Service[] = (data || []).map((apiService): Service => ({
        id: apiService.id,
        name: apiService.name,
        endpoint: apiService.endpoint || null,
        availability: apiService.availability ?? null,
        response_time: apiService.response_time ?? null,
      }));

      // Sort by created_at descending (newest first)
      mappedServices.sort((a, b) => {
        // Since we don't have created_at in the response, we'll just return the data as-is
        // If sorting is needed, it should be done on the backend
        return 0;
      });

      setServices(mappedServices);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusFromAvailability = (availability: number | null) => {
    if (!availability) return "unknown";
    if (availability >= 99.5) return "healthy";
    if (availability >= 98) return "warning";
    return "critical";
  };

  if (loading) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-foreground">Monitored Services</CardTitle>
          <CardDescription>Overview of your SaaS application integrations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">Loading services...</div>
        </CardContent>
      </Card>
    );
  }

  if (services.length === 0) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-foreground">Monitored Services</CardTitle>
          <CardDescription>Overview of your SaaS application integrations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No services added yet</p>
            <Button onClick={() => navigate("/add-service")}>Add Your First Service</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-foreground">Monitored Services</CardTitle>
        <CardDescription>Overview of your SaaS application integrations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.map((service) => {
            const status = getStatusFromAvailability(service.availability);
            
            return (
              <div
                key={service.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/service/${service.id}`)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{service.name}</h3>
                      <Badge
                        variant={status === "healthy" ? "default" : status === "warning" ? "secondary" : "destructive"}
                        className={
                          status === "healthy"
                            ? "bg-success/20 text-success border-success/50"
                            : status === "warning"
                            ? "bg-warning/20 text-warning border-warning/50"
                            : "bg-destructive/20 text-destructive border-destructive/50"
                        }
                      >
                        <Activity className="h-3 w-3 mr-1" />
                        {status}
                      </Badge>
                    </div>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      {service.availability && (
                        <span>Uptime: {service.availability}%</span>
                      )}
                      {service.response_time && (
                        <span>Avg Latency: {service.response_time}ms</span>
                      )}
                      {service.endpoint && (
                        <span className="font-mono truncate max-w-xs">{service.endpoint}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="ml-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/service/${service.id}`);
                  }}
                >
                  View Details
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ServicesList;
