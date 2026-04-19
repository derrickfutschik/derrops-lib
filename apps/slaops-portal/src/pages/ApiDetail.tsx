import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Pencil } from 'lucide-react'
import { ApiManagementModeBadge } from '@/components/apis/ApiManagementModeBadge'
import { ApiStrategyBadge } from '@/components/apis/ApiStrategyBadge'
import { ApiStatsCard } from '@/components/apis/ApiStatsCard'
import { ApiFetchStatusCard } from '@/components/apis/ApiFetchStatusCard'
import { SpecUploadCard } from '@/components/apis/SpecUploadCard'
import { OperationsTab } from '@/components/apis/OperationsTab'
import { ServersTab } from '@/components/apis/ServersTab'
import { ParametersTab } from '@/components/apis/ParametersTab'
import { ModelsTab } from '@/components/apis/ModelsTab'
import { EditApiDrawer } from '@/components/apis/EditApiDrawer'
import { useApi } from '@/hooks/useApisApi'
import { ApiEntityManagementModeEnum, VersionFetchStateStrategyEnum } from '@/client/slaops-cloud'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectDetailTab, setDetailTab } from '@/store/apisSlice'
import { formatDistanceToNow } from 'date-fns'
import type { ApiEntity } from '@/client/slaops-cloud'

function OverviewTab({ api }: { api: ApiEntity }) {
  const isPrivate = api.managementMode !== ApiEntityManagementModeEnum.Platform
  const isUrlFetch = api.fetch?.strategy === VersionFetchStateStrategyEnum.UrlFetch

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">API Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {[
            { label: 'Name', value: api.name },
            { label: 'Description', value: api.description || <span className="text-muted-foreground italic">none</span> },
            {
              label: 'External URL',
              value: api.externalUrl
                ? <a href={api.externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{api.externalUrl}</a>
                : <span className="text-muted-foreground italic">none</span>,
            },
            { label: 'Mode', value: <ApiManagementModeBadge mode={api.managementMode} /> },
            ...(isPrivate ? [{ label: 'Strategy', value: <ApiStrategyBadge strategy={api.fetch?.strategy} /> }] : []),
            { label: 'Created', value: formatDistanceToNow(new Date(api.createdAt), { addSuffix: true }) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm text-right max-w-[60%]">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {api.oaSpec && <ApiStatsCard oaSpec={api.oaSpec} />}
        {isPrivate && <SpecUploadCard apiId={api.id} title={api.oaSpec?.latestVersion ? 'Re-index spec' : 'Upload spec'} />}
        {isUrlFetch && api.fetch && <ApiFetchStatusCard fetch={api.fetch} />}
      </div>
    </div>
  )
}

const ApiDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const activeTab = useAppSelector(selectDetailTab)
  const [editOpen, setEditOpen] = useState(false)

  const { data: api, isLoading } = useApi(id ?? '')

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!api) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">API not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/apis')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{api.name}</h1>
                  <ApiManagementModeBadge mode={api.managementMode} />
                </div>
                <p className="text-xs text-muted-foreground">
                  <span
                    className="cursor-pointer hover:underline"
                    onClick={() => navigate('/apis')}
                  >
                    APIs
                  </span>
                  {' > '}
                  {api.name}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={(v) => dispatch(setDetailTab(v as typeof activeTab))}>
          <TabsList className="bg-secondary/50 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="servers">Servers</TabsTrigger>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab api={api} /></TabsContent>

          <TabsContent value="versions">
            <div className="text-center py-12 text-muted-foreground text-sm">
              <p>Version history coming soon — run a new indexing pass to update.</p>
              <Button variant="outline" size="sm" className="mt-3" disabled>Diff</Button>
            </div>
          </TabsContent>

          <TabsContent value="operations">
            <OperationsTab operations={[]} />
          </TabsContent>

          <TabsContent value="servers">
            <ServersTab servers={[]} />
          </TabsContent>

          <TabsContent value="parameters">
            <ParametersTab parameters={[]} />
          </TabsContent>

          <TabsContent value="models">
            <ModelsTab models={[]} />
          </TabsContent>
        </Tabs>
      </main>

      <EditApiDrawer api={api} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  )
}

export default ApiDetail
