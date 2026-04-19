import { Button } from '@/components/ui/button'
import { ApiTable } from '@/components/apis/ApiTable'
import { useApis } from '@/hooks/useApisApi'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const Apis = () => {
  const navigate = useNavigate()
  const { data: apis = [], isLoading } = useApis()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">APIs</h1>
                <p className="text-xs text-muted-foreground">Manage your OpenAPI specifications</p>
              </div>
            </div>
            <Button onClick={() => navigate('/apis/new')}>New API</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isLoading && apis.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">No APIs yet — add your first API to get started.</p>
            <Button onClick={() => navigate('/apis/new')}>New API</Button>
          </div>
        ) : (
          <ApiTable apis={apis} isLoading={isLoading} />
        )}
      </main>
    </div>
  )
}

export default Apis
