import DashboardHeader from '@/components/dashboard/DashboardHeader'
import ServicesList from '@/components/dashboard/ServicesList'
import StatsOverview from '@/components/dashboard/StatsOverview'
import { supabase } from '@/integrations/supabase/client'
import { Session, User } from '@supabase/supabase-js'
import { signOut } from 'aws-amplify/auth'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const Dashboard = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      // if (!session) {
      //   navigate("/auth");
      // }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)

      // if (!session) {
      //   navigate("/auth");
      // }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  const handleSignOut = async () => {
    // await supabase.auth.signOut();
    // toast.success("Signed out successfully");
    await signOut({ global: true })
    navigate('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} onSignOut={handleSignOut} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatsOverview />
        <ServicesList />
      </main>
    </div>
  )
}

export default Dashboard
