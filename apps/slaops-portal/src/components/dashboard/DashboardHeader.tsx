import { Button } from '@/components/ui/button'
import { User } from '@supabase/supabase-js'
import { FlaskConical, LogOut, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface DashboardHeaderProps {
  user: User | null
  onSignOut: () => void
}

const DashboardHeader = ({ user, onSignOut }: DashboardHeaderProps) => {
  const navigate = useNavigate()

  return (
    <header className="border-b border-border bg-card/30 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              SLA<span className="text-primary">Ops</span>
            </h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/api-tester')}>
              <FlaskConical className="h-4 w-4 mr-2" />
              API Tester
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/add-service')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader
