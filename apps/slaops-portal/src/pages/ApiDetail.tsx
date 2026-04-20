import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiDetailHeader } from '@/components/apis/ApiDetailHeader'
import { OverviewTab } from '@/components/apis/OverviewTab'
import { VersionsTab } from '@/components/apis/VersionsTab'
import { OperationsTab } from '@/components/apis/OperationsTab'
import { ServersTab } from '@/components/apis/ServersTab'
import { ParametersTab } from '@/components/apis/ParametersTab'
import { ModelsTab } from '@/components/apis/ModelsTab'
import { EditApiDrawer } from '@/components/apis/EditApiDrawer'
import { useApi } from '@/hooks/useApisApi'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectDetailTab, setDetailTab } from '@/store/apisSlice'
import { resetAllTabs } from '@/store/apiTabsSlice'

const ApiDetail = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const activeTab = useAppSelector(selectDetailTab)
  const [editOpen, setEditOpen] = useState(false)

  const { data: api, isLoading } = useApi(id ?? '')

  useEffect(() => {
    dispatch(resetAllTabs())
  }, [id, dispatch])

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
      <ApiDetailHeader api={api} onEdit={() => setEditOpen(true)} />

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
          <TabsContent value="versions"><VersionsTab apiId={id ?? ''} /></TabsContent>
          <TabsContent value="operations"><OperationsTab apiId={id ?? ''} /></TabsContent>
          <TabsContent value="servers"><ServersTab apiId={id ?? ''} /></TabsContent>
          <TabsContent value="parameters"><ParametersTab apiId={id ?? ''} /></TabsContent>
          <TabsContent value="models"><ModelsTab apiId={id ?? ''} /></TabsContent>
        </Tabs>
      </main>

      <EditApiDrawer api={api} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  )
}

export default ApiDetail
