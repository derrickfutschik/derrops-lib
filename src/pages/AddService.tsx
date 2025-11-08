import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to add a service",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("services").insert({
        user_id: user.id,
        name: formData.name,
        openapi_doc_url: formData.openapi_doc_url || null,
        openapi_doc_content: formData.openapi_doc_content || null,
        endpoint: formData.endpoint || null,
        availability: formData.availability ? parseFloat(formData.availability) : null,
        response_time: formData.response_time ? parseInt(formData.response_time) : null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service added successfully",
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add service",
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
