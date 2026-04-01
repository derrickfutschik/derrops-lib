import { AegisInstancesTab } from '@/components/connections/AegisInstancesTab'
import { HealthDashboardTab } from '@/components/connections/HealthDashboardTab'
import { RelayInstancesTab } from '@/components/connections/RelayInstancesTab'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAegisInstances, useRelayInstances } from '@/hooks/useConnectionsApi'
import { signOut } from 'aws-amplify/auth'
import { ArrowLeft, LogOut, Radio, Shield, Activity } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const Connections = () => {
  const navigate = useNavigate()
  const relaysQuery = useRelayInstances()
  const aegisQuery = useAegisInstances()
  const [registerRelayOpen, setRegisterRelayOpen] = useState(false)

  const handleRefresh = useCallback(() => {
    relaysQuery.refetch()
    aegisQuery.refetch()
  }, [relaysQuery, aegisQuery])

  const handleSignOut = async () => {
    await signOut({ global: true })
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Settings <span className="text-muted-foreground font-normal">/ Connections</span>
                </h1>
                <p className="text-xs text-muted-foreground">
                  Manage relay and Aegis instances
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="relays">
          <TabsList className="bg-secondary/50 mb-6">
            <TabsTrigger value="relays" className="gap-2">
              <Radio className="h-3.5 w-3.5" />
              Relay Instances
            </TabsTrigger>
            <TabsTrigger value="aegis" className="gap-2">
              <Shield className="h-3.5 w-3.5" />
              Aegis Instances
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2">
              <Activity className="h-3.5 w-3.5" />
              Health Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="relays">
            <RelayInstancesTab
              relays={relaysQuery.data ?? []}
              aegisInstances={aegisQuery.data ?? []}
              isLoading={relaysQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="aegis">
            <AegisInstancesTab
              aegisInstances={aegisQuery.data ?? []}
              relayInstances={relaysQuery.data ?? []}
              isLoading={aegisQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="health">
            <HealthDashboardTab
              relays={relaysQuery.data ?? []}
              aegisInstances={aegisQuery.data ?? []}
              isLoading={relaysQuery.isLoading || aegisQuery.isLoading}
              onRefresh={handleRefresh}
              onRegisterRelay={() => {
                // Switch to relay tab — handled by user manually for now
              }}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default Connections
