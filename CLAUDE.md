# SLAOps Portal

React web portal for monitoring, API testing, and service management. Built with Vite + React 18 + TypeScript, using AWS Amplify for auth and a generated OpenAPI client for backend communication.

## Directory Structure

```
src/
├── pages/              # Page-level components (one per route)
├── components/
│   ├── ui/             # shadcn/ui Radix-based primitives (do not modify directly)
│   ├── api-tester/     # API tester feature components
│   └── dashboard/      # Dashboard feature components
├── store/              # Redux store, slices, and typed hooks
├── hooks/              # Shared custom hooks
├── lib/                # Utilities (cn() helper)
├── integrations/
│   └── supabase/       # Supabase client and generated types
├── client/
│   └── slaops-cloud/   # Generated OpenAPI TypeScript client (do not edit)
├── App.tsx             # Routing, auth wiring, QueryClient setup
├── main.tsx            # React DOM entry point
└── config.ts           # API base URL
```

## State Management (Redux Toolkit)

**Use Redux Toolkit for shared UI state.** Do not reach for `useState` when state is needed across components or when the state is complex enough to benefit from actions and selectors.

### Store layout

```
src/store/
├── index.ts          # configureStore, RootState, AppDispatch exports
├── hooks.ts          # useAppDispatch, useAppSelector (always use these, not raw hooks)
├── apiTesterSlice.ts # UI state for the API tester (collapsed panels, active tabs)
└── responseViewerSlice.ts # Response viewer state (view mode, JMESPath, sorting, columns)
```

### Conventions

- **Typed hooks only.** Import `useAppDispatch` and `useAppSelector` from `store/hooks.ts`. Never import the raw `useDispatch`/`useSelector` from react-redux.
- **One slice per feature area.** Create a new slice file under `src/store/` when a new feature requires shared state.
- **Export selectors from the slice.** Define `select*` selectors alongside the slice and export them, so components don't need to know the store shape.
- **Local UI state stays local.** Use `useState` for state that belongs entirely within a single component (hover, open/closed, input value while typing).

### Example

```typescript
// store/myFeatureSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface MyFeatureState {
  activeTab: string
}

const initialState: MyFeatureState = { activeTab: 'request' }

const myFeatureSlice = createSlice({
  name: 'myFeature',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<string>) {
      state.activeTab = action.payload
    },
  },
})

export const { setActiveTab } = myFeatureSlice.actions
export const selectActiveTab = (state: RootState) => state.myFeature.activeTab
export default myFeatureSlice.reducer

// In a component
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setActiveTab, selectActiveTab } from '@/store/myFeatureSlice'

const activeTab = useAppSelector(selectActiveTab)
const dispatch = useAppDispatch()
dispatch(setActiveTab('response'))
```

## Component Conventions

### Size and composition

- **Max ~300–400 lines per file.** If a component grows beyond this, extract sub-components.
- **No inline render functions longer than ~20 lines.** Extract them into named components in sibling files.
- **Sibling files over sub-directories.** Extracted components live next to the file they came from (e.g. `JMESPathInputRow.tsx` alongside `MaximizableCodeViewer.tsx`), not in a generic `components/` subdirectory.
- **Extract by responsibility.** If a chunk of JSX has its own local state, refs, and callbacks, it belongs in its own component file.
- **Pass only what's needed as props.** Don't hoist state unnecessarily; the parent owns shared state, children own their own.
- **Pure helpers travel with their consumer.** Utility functions used only by one component live in that component's file (or a sibling `*-utils.ts`).

### Anti-patterns to avoid

- A single `.tsx` file exceeding ~500 lines without a clear reason.
- Inline JSX assigned to variables (`const row = () => <div>...100 lines...</div>`) — these are components; make them components.
- Dumping all logic into one parent and passing dozens of props through layers — co-locate instead.

### Naming

- **PascalCase** for component files and component names: `DashboardHeader.tsx`, `OpenAPIParameterForm.tsx`.
- **Props interface** named `<ComponentName>Props`.
- **Page components** in `src/pages/`, one per route, PascalCase.
- **Feature groupings** in `src/components/<feature-name>/`.

## Routing

React Router v6. Routes are defined in `App.tsx`.

- Public routes: `/`, `/auth`
- Protected routes: wrapped in `<ProtectedRoute>`, which checks `getCurrentUser()` from `aws-amplify/auth`
- Use `useNavigate` for programmatic navigation; never `window.location`

When adding a route, add it to `App.tsx` and create the page component in `src/pages/`.

## Authentication

AWS Cognito via AWS Amplify:

- `Amplify.configure(outputs)` from `amplify_outputs.json` is called in `main.tsx`
- Auth UI: `@aws-amplify/ui-react` Authenticator component on `/auth`
- Auth checks: `getCurrentUser()` from `aws-amplify/auth`
- Auth events: `Hub.listen('auth', ...)` for `signedIn` / `signedOut`
- Supabase auth is also wired in — `supabase.auth.onAuthStateChange()` keeps Supabase sessions in sync

## Data Fetching

### OpenAPI generated client (preferred for backend calls)

```typescript
import { Configuration, ServiceApi } from '@/client/slaops-cloud'
import { config } from '@/config'

const cfg = new Configuration({ basePath: config.apiBaseUrl })
const serviceApi = new ServiceApi(cfg)
const services = await serviceApi.serviceControllerFindAll()
```

The client lives in `src/client/slaops-cloud/` and is auto-generated — **do not edit it manually**. Regenerate when the backend API changes.

### React Query (for async state in components)

`QueryClient` is set up in `App.tsx`. Use `useQuery` / `useMutation` from `@tanstack/react-query` when you need caching, loading states, or background refetching. Avoid manual `useEffect` + `useState` data-fetching patterns for new code.

### Supabase

Use the client from `src/integrations/supabase/client.ts`. Types are auto-generated in `src/integrations/supabase/types.ts` — do not edit those.

## Styling

- **Tailwind CSS v3** for all styling. Use utility classes directly.
- **`cn()` from `@/lib/utils`** to merge conditional Tailwind classes:
  ```typescript
  import { cn } from '@/lib/utils'
  className={cn('base-class', isActive && 'active-class', className)}
  ```
- **shadcn/ui** for UI primitives (`src/components/ui/`). Use these before building custom versions. Do not modify these files directly — copy and customize in feature component directories if needed.
- **Dark mode** is class-based (`darkMode: ['class']`). Use `dark:` variants for dark mode styles.
- **No inline styles** unless absolutely necessary for dynamic values that can't be expressed in Tailwind.

## Forms

- **React Hook Form + Zod** for forms with validation. Both are installed and preferred for new form work.
- Simple, low-stakes forms (single field, no validation) may use `useState` controlled inputs.
- Define Zod schemas alongside the form component file. Use `zodResolver` from `@hookform/resolvers/zod`.

## Error Handling

**Never use `any` in catch blocks.** Always type catch parameters as `unknown` and use type guards.

```typescript
// ✅ Correct
try {
  await someOperation()
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  toast({ title: 'Error', description: message, variant: 'destructive' })
}

// ❌ Wrong
try {
  await someOperation()
} catch (error: any) {
  toast({ description: error.message })
}
```

### Common patterns

**Toast notifications**

```typescript
try {
  await someAsyncOperation()
  toast({ title: 'Success', description: 'Operation completed' })
} catch (error: unknown) {
  toast({
    title: 'Error',
    description: error instanceof Error ? error.message : 'Operation failed',
    variant: 'destructive',
  })
}
```

**Loading state**

```typescript
try {
  setLoading(true)
  const data = await fetchData()
  setData(data)
} catch (error: unknown) {
  setError(error instanceof Error ? error.message : 'Failed to load data')
} finally {
  setLoading(false)
}
```

**API errors** (check for response payload)

```typescript
catch (error: unknown) {
  if (error instanceof Error && 'response' in error) {
    const apiError = error as { response?: { data?: { message?: string } } }
    const message = apiError.response?.data?.message || error.message
    toast({ description: message, variant: 'destructive' })
  } else {
    const message = error instanceof Error ? error.message : 'Request failed'
    toast({ description: message, variant: 'destructive' })
  }
}
```

## TypeScript Conventions

- Path alias `@/*` maps to `src/*`. Always use this over relative imports that cross feature boundaries.
- Props interfaces use the `<ComponentName>Props` suffix.
- Types and interfaces co-located with the component that owns them. Shared types live in the most-consuming package or a `types.ts` sibling.
- `strict` is off in tsconfig — but still write as if it were on. Avoid `any`, use `unknown` for truly unknown values, and annotate function return types on public APIs.
- Generated files (`src/client/`, `src/integrations/supabase/types.ts`) are not to be manually edited.

## Keyboard Shortcuts (api-tester)

When adding keyboard shortcuts to any component in `src/components/api-tester/`, you **must** also update `HotkeyInfoDialog.tsx` — it is the single source of truth for the `⌘H` shortcuts popup.

See `src/components/api-tester/CLAUDE.md` for the full shortcut table and instructions.

## Testing

- **Vitest** for unit tests. Config in `vitest.config.ts`.
- Test files use `.test.ts` / `.test.tsx` suffix and live alongside the code they test (or in `test/` for standalone utilities).
- Use `describe` / `it` / `expect` patterns consistent with `test/joining-utils.test.ts`.
- Components with meaningful logic should have tests. Pure UI/presentation components without logic do not require tests.

## Development

```bash
pnpm run dev       # Dev server on port 8080
pnpm run build     # Production build
pnpm run build:dev # Dev build
pnpm run lint      # ESLint
pnpm run test      # Vitest
pnpm run test:watch
```

Environment variables: copy `.env.example` → `.env` and fill in values.
