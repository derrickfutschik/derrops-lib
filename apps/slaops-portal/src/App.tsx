import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Authenticator } from "@aws-amplify/ui-react";
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import AddService from "./pages/AddService";
import ServiceDetails from "./pages/ServiceDetails";
import ApiTester from "./pages/ApiTester";
import NotFound from "./pages/NotFound";
import '@aws-amplify/ui-react/styles.css';

import outputs from '../amplify_outputs.json';

const queryClient = new QueryClient();

Amplify.configure(outputs);

// Auth Page wrapper - shows Amplify UI and listens for sign-in events
const AuthPage = () => {
  const navigate = useNavigate();
  const hasRedirected = React.useRef(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);

  React.useEffect(() => {
    // Check if user is already authenticated on mount
    const checkExistingAuth = async () => {
      try {
        const user = await getCurrentUser();
        console.log('AuthPage: User already authenticated:', user);
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.log('AuthPage: No existing user session');
        setIsCheckingAuth(false);
      }
    };

    checkExistingAuth();

    // Listen for auth events
    const hubListener = Hub.listen('auth', (data) => {
      console.log('Auth Hub event:', data.payload.event);

      switch (data.payload.event) {
        case 'signedIn':
          console.log('User signed in successfully!');
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            console.log('Redirecting to dashboard...');
            navigate('/dashboard', { replace: true });
          }
          break;
        case 'signInWithRedirect':
          console.log('Sign in with redirect');
          break;
        case 'signInWithRedirect_failure':
          console.log('Sign in with redirect failed');
          break;
        case 'signedOut':
          console.log('User signed out');
          break;
      }
    });

    // Cleanup listener on unmount
    return () => hubListener();
  }, [navigate]);

  if (isCheckingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Authenticator>
        {({ signOut, user }) => {
          console.log('Authenticator render - user:', user);
          // This will only render if user is authenticated
          return null;
        }}
      </Authenticator>
    </div>
  );
};

// Protected Route wrapper - checks auth manually
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      await getCurrentUser();
      console.log('ProtectedRoute: User is authenticated');
      setIsAuthenticated(true);
    } catch (error) {
      console.log('ProtectedRoute: User is not authenticated');
      setIsAuthenticated(false);
    }
  };

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: Redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  console.log('ProtectedRoute: Rendering children');
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/add-service" element={<ProtectedRoute><AddService /></ProtectedRoute>} />
          <Route path="/service/:id" element={<ProtectedRoute><ServiceDetails /></ProtectedRoute>} />
          <Route path="/api-tester" element={<ProtectedRoute><ApiTester /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;