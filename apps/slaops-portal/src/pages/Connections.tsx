import { ConnectionsTab } from '@/components/connections/ConnectionsTab'
import { HealthDashboardTab } from '@/components/connections/HealthDashboardTab'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAegisInstances, useConnections } from '@/hooks/useConnectionsApi'
import { signOut } from 'aws-amplify/auth'
import { ArrowLeft, LogOut, Activity, Cable } from 'lucide-react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const Connections = () => {
  const navigate = useNavigate()
  const connectionsQuery = useConnections()
  const aegisQuery = useAegisInstances()

  const handleRefresh = useCallback(() => {
    connectionsQuery.refetch()
    aegisQuery.refetch()
  }, [connectionsQuery, aegisQuery])

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
                  Manage relay connections and Aegis token brokers
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
        <Tabs defaultValue="connections">
          <TabsList className="bg-secondary/50 mb-6">
            <TabsTrigger value="connections" className="gap-2">
              <Cable className="h-3.5 w-3.5" />
              Connections
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2">
              <Activity className="h-3.5 w-3.5" />
              Health Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections">
            <ConnectionsTab
              connections={connectionsQuery.data ?? []}
              aegisInstances={aegisQuery.data ?? []}
              isLoading={connectionsQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="health">
            <HealthDashboardTab
              relays={[]}
              aegisInstances={aegisQuery.data ?? []}
              isLoading={connectionsQuery.isLoading || aegisQuery.isLoading}
              onRefresh={handleRefresh}
              onRegisterRelay={() => {}}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default Connections
