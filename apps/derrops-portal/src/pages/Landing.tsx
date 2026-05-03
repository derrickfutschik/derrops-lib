import { Button } from '@/components/ui/button'
import { ArrowRight, BarChart3, Bell, Shield, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const Landing = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-hero)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(6,182,212,0.1),transparent_50%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center space-y-8">
            <div className="inline-block">
              <h1 className="text-6xl md:text-7xl font-bold text-foreground mb-2">
                SLA<span className="text-primary">Ops</span>
              </h1>
              <p className="text-xl text-muted-foreground">
                Monitor Your SaaS Stack with Confidence
              </p>
            </div>

            <p className="text-lg text-foreground/80 max-w-2xl mx-auto">
              Track API performance, usage, and costs across all your SaaS applications. Get
              real-time insights and AI-powered anomaly detection.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8" onClick={() => navigate('/auth')}>
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8"
                onClick={() => navigate('/auth')}
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">Complete SaaS Observability</h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to monitor and optimize your SaaS applications
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-[var(--shadow-glow)] transition-all duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Real-Time Metrics</h3>
            <p className="text-muted-foreground">
              Track usage, latency, throughput, and availability in real-time
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-[var(--shadow-glow)] transition-all duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Security & Compliance</h3>
            <p className="text-muted-foreground">
              Monitor security metrics and ensure compliance across your stack
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-[var(--shadow-glow)] transition-all duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">AI Investigation</h3>
            <p className="text-muted-foreground">
              Automatic anomaly detection and intelligent issue investigation
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-[var(--shadow-glow)] transition-all duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Smart Alerts</h3>
            <p className="text-muted-foreground">
              Get notified about usage spikes, errors, and cost overruns
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-card/50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">Simple Integration</h2>
            <p className="text-lg text-muted-foreground">Get up and running in minutes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Install SDK</h3>
              <p className="text-muted-foreground">
                Add our SDK to your application and hook into your REST client
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Configure S3 Sync</h3>
              <p className="text-muted-foreground">
                Set up S3 sync from your AWS account to ours for log collection
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Monitor & Analyze</h3>
              <p className="text-muted-foreground">
                View enriched logs and metrics on our platform
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join teams monitoring their SaaS applications with Derrops
          </p>
          <Button size="lg" className="text-lg px-8" onClick={() => navigate('/auth')}>
            Start Monitoring Now <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Landing
