# SLAOps Portal

## Overview

SLAOps Portal is the frontend web application for the SLAOps platform - a SaaS monitoring solution that analyzes HTTP requests from client applications to provide meaningful insights about API usage, performance, and costs.

The platform ingests HTTP requests in HAR (HTTP Archive) format, processes them, and presents actionable analytics through this React-based dashboard.

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Authentication**: Supabase Auth
- **Backend Integration**: Supabase
- **UI Components**: Radix UI primitives via shadcn/ui
- **Charts**: Recharts
- **Form Handling**: React Hook Form with Zod validation
- **Generated with**: Lovable

## Project Structure

```
apps/slaops-portal/
├── src/
│   ├── components/         # Reusable React components
│   │   ├── ui/            # shadcn/ui components
│   │   └── dashboard/     # Dashboard-specific components
│   ├── pages/             # Route pages
│   │   ├── Landing.tsx    # Landing page
│   │   ├── Auth.tsx       # Authentication
│   │   ├── Dashboard.tsx  # Main dashboard
│   │   ├── AddService.tsx # Service configuration
│   │   └── ServiceDetails.tsx
│   ├── integrations/      # External service integrations
│   │   └── supabase/      # Supabase client & types
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   └── App.tsx            # Main application component
├── public/                # Static assets
├── supabase/             # Supabase configuration
└── dist/                 # Build output
```

## Key Features

### Dashboard
- Real-time service monitoring
- API call metrics and trends
- Active alerts management
- Cost tracking and analysis
- Service health status overview

### Service Management
- Add and configure monitored services
- View detailed service analytics
- Track API performance metrics
- Monitor SLA compliance

### Analytics
- Request/response tracking
- Performance metrics visualization
- Cost analysis
- Alert management

## Development

### Prerequisites
- Node.js (version specified in .nvmrc)
- npm or pnpm
- Supabase account and project

### Environment Variables
Create a `.env` file with:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Getting Started

```bash
# Install dependencies
npm install
# or
pnpm install

# Start development server
npm run dev

# Build for production
npm run build

# Build for development environment
npm run build:dev

# Preview production build
npm run preview
```

The development server runs on `http://[::]:8080`

### Code Quality

```bash
# Run ESLint
npm run lint
```

## Architecture

### Authentication Flow
The application uses Supabase Auth for user management:
1. Users land on the Landing page
2. Authentication handled via `/auth` route
3. Protected routes check session state
4. Automatic redirect to auth if session expires

### Data Flow
1. Client applications send HTTP requests (HAR format)
2. Backend processes and stores events in Supabase
3. Portal queries data via Supabase client
4. TanStack Query manages caching and state
5. UI components render analytics and insights

### Component Architecture
- **shadcn/ui**: Provides accessible, customizable UI primitives
- **Composition**: Components compose smaller pieces for flexibility
- **Type Safety**: Full TypeScript coverage with Zod schemas
- **Responsive**: Mobile-first design with Tailwind breakpoints

## Deployment

### AWS Amplify
This project is configured for AWS Amplify deployment:
- `amplify.yml`: Build configuration
- `amplify-prebuild.sh`: Pre-build setup
- `amplify-build.sh`: Build execution

### Lovable Platform
The application can be deployed directly through Lovable:
1. Visit the [Lovable Project](https://lovable.dev/projects/957a6ce2-2634-4e8d-a9e2-8b7b8e425798)
2. Click Share → Publish
3. Configure custom domain if needed

## Integration with SLAOps Platform

This portal is part of the larger SLAOps ecosystem:

### Related Components
- **slaops-client-nodejs-axios**: Node.js client library for capturing Axios HTTP requests
- **Backend Services**: Process and store HTTP events
- **Collector Endpoints**: Receive events from instrumented applications

### Data Collection
Applications integrate the SLAOps client to automatically capture:
- HTTP request/response pairs
- Timing metrics
- Headers (with optional redaction)
- Request/response bodies (optional)
- Performance metadata

## Key Dependencies

### Core
- `react` & `react-dom`: ^18.3.1
- `typescript`: ^5.8.3
- `vite`: ^5.4.21

### UI & Styling
- `tailwindcss`: ^3.4.17
- `@radix-ui/*`: Various versions for UI primitives
- `lucide-react`: ^0.462.0 (icons)

### Data & State
- `@tanstack/react-query`: ^5.83.0
- `@supabase/supabase-js`: ^2.80.0
- `react-hook-form`: ^7.61.1
- `zod`: ^3.25.76

### Visualization
- `recharts`: ^2.15.4

## Best Practices

### Working with shadcn/ui
Components are copied into the project and fully customizable. Modify them in `src/components/ui/` as needed.

### State Management
- Use TanStack Query for server state
- Keep component state local when possible
- Leverage Supabase realtime subscriptions for live updates

### Type Safety
- All Supabase types are generated in `src/integrations/supabase/types.ts`
- Use Zod schemas for form validation
- Maintain strict TypeScript configuration

### Styling
- Use Tailwind utility classes
- Follow the design system tokens in `tailwind.config.ts`
- Support dark mode via `next-themes`

## Troubleshooting

### Build Issues
- Ensure all environment variables are set
- Check Node.js version matches `.nvmrc`
- Clear `node_modules` and reinstall if needed

### Authentication Issues
- Verify Supabase credentials in `.env`
- Check Supabase project settings
- Ensure redirect URLs are configured

### Development Server
- Default port is 8080
- Configured to listen on all interfaces (`::``)
- Check for port conflicts if server won't start

## Contributing

This project was generated with Lovable. Changes can be made:
1. Via Lovable web interface (automatic commits)
2. Local development with IDE (manual commits)
3. GitHub web editor
4. GitHub Codespaces

## License

Check the parent repository for license information.

## Support

For issues specific to this portal, create an issue in the repository.
For SLAOps platform questions, refer to the main platform documentation.
