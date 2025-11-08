import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

const mockServices = [
  {
    id: 1,
    name: "Stripe API",
    status: "healthy",
    uptime: "99.9%",
    calls: "450K",
    avgLatency: "120ms",
    trend: "up",
    alerts: 0,
  },
  {
    id: 2,
    name: "Twilio API",
    status: "healthy",
    uptime: "99.7%",
    calls: "280K",
    avgLatency: "95ms",
    trend: "up",
    alerts: 0,
  },
  {
    id: 3,
    name: "SendGrid API",
    status: "warning",
    uptime: "98.5%",
    calls: "320K",
    avgLatency: "250ms",
    trend: "down",
    alerts: 2,
  },
  {
    id: 4,
    name: "AWS S3",
    status: "healthy",
    uptime: "99.99%",
    calls: "1.2M",
    avgLatency: "45ms",
    trend: "up",
    alerts: 0,
  },
];

const ServicesList = () => {
  return (
    <Card className="border-border bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-foreground">Monitored Services</CardTitle>
        <CardDescription>Overview of your SaaS application integrations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockServices.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{service.name}</h3>
                    <Badge
                      variant={service.status === "healthy" ? "default" : "secondary"}
                      className={
                        service.status === "healthy"
                          ? "bg-success/20 text-success border-success/50"
                          : "bg-warning/20 text-warning border-warning/50"
                      }
                    >
                      <Activity className="h-3 w-3 mr-1" />
                      {service.status}
                    </Badge>
                    {service.alerts > 0 && (
                      <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/50">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {service.alerts} alerts
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-6 text-sm text-muted-foreground">
                    <span>Uptime: {service.uptime}</span>
                    <span>Calls: {service.calls}</span>
                    <span>Avg Latency: {service.avgLatency}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {service.trend === "up" ? (
                    <TrendingUp className="h-5 w-5 text-success" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  )}
                </div>
              </div>
              
              <Button variant="ghost" size="sm" className="ml-4">
                View Details
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ServicesList;
