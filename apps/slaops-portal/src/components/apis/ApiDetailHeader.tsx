import type { ApiEntity } from '@/client/slaops-cloud'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ApiManagementModeBadge } from './ApiManagementModeBadge'

interface ApiDetailHeaderProps {
  api: ApiEntity
  onEdit: () => void
}

export function ApiDetailHeader({ api, onEdit }: ApiDetailHeaderProps) {
  const navigate = useNavigate()

  return (
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
                <span className="cursor-pointer hover:underline" onClick={() => navigate('/apis')}>
                  APIs
                </span>
                {' > '}
                {api.name}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        </div>
      </div>
    </header>
  )
}
