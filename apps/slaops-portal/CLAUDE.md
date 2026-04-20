# SLAOps Portal

React web portal for monitoring, API testing, and service management. Built with Vite + React 18 + TypeScript, using AWS Amplify for auth and a generated OpenAPI client for backend communication.

## CRITICAL: No cross-project imports

**The portal must be buildable in isolation.** It must never import from other packages in this monorepo (`@slaops/*`, `slaops-cloud`, `slaops-aegis`, etc.).

All backend communication **must** go through the generated OpenAPI client at `src/client/slaops-cloud/`. When the backend API changes, regenerate the client — do not reach into backend source code directly.

```typescript
// ✅ Correct — generated client only
import { ServiceApi } from '@/client/slaops-cloud'

// ❌ Wrong — never import from other monorepo packages
import { something } from '@slaops/private'
import { helper } from '../../slaops-cloud/src/...'
```

Auth is handled by `cloudAxios` in `src/lib/cloud-api.ts` — its request interceptor attaches the Cognito Bearer token on every outgoing request automatically. **Do not call `getAuthHeaders()` or any other auth helper manually** — pass requests through `cloudAxios` and the token is injected for you.

## CRITICAL: Never define local types for API response shapes

**Never declare a local interface or type that mirrors a backend response.** Always import generated models from `src/client/slaops-cloud/models/`.

The generated client is the single source of truth for the backend contract. When you declare a local type instead of importing the generated one, that local type immediately begins drifting — field names change, optional fields become required, new fields are added — and the compiler can't catch the mismatch because it only knows about the local type. The result is runtime breakage that looks like a frontend bug but is actually a schema sync problem.

```typescript
// ✅ Correct — generated model stays in sync with the backend
import { SomeModel } from '@/client/slaops-cloud'
const { data } = await cloudAxios.post<SomeModel>(...)

// ❌ Wrong — local copy that will drift
interface MyModel { field: string; ... }
const { data } = await cloudAxios.post<MyModel>(...)
```

If the endpoint is not yet in the generated client (e.g. a long-poll `/wait` path), type the response as the closest matching generated model rather than inventing a local interface. Only define local types for shapes that are **purely internal** — data that has been mapped or transformed after the API response and has no corresponding backend model.

=======

- **Tech**: React 18 · Vite · TypeScript · Redux Toolkit · shadcn/ui · AWS Amplify (Cognito)
- **Dev port**: 8080

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
├── index.ts               # configureStore, RootState, AppDispatch exports
├── hooks.ts               # useAppDispatch, useAppSelector (always use these, not raw hooks)
├── actionMeta.ts          # ActionArea/ActionGroup enums, ActionMeta type,
│                          #   RegisteredAction type, ActionRegistry class,
│                          #   actionRegistry singleton
├── apiTesterSlice.ts      # Request-building UI state (tabs, section collapse)
├── apiRequestSlice.ts     # Send-request state (isSendingRequest, requestResponse)
└── responseViewerSlice.ts # Response viewer state (view mode, JMESPath, sorting, columns)
```

### Conventions

- **Typed hooks only.** Import `useAppDispatch` and `useAppSelector` from `store/hooks.ts`. Never import the raw `useDispatch`/`useSelector` from react-redux.
- **One slice per feature area.** Create a new slice file under `src/store/` when a new feature requires shared state.
- **Export selectors from the slice.** Define `select*` selectors alongside the slice and export them, so components don't need to know the store shape.
- **Local UI state stays local.** Use `useState` for state that belongs entirely within a single component (hover, open/closed, input value while typing).

### Logic belongs outside components

**Components must not contain business logic inline.** Any logic that goes beyond rendering should live in a dedicated hook or Redux slice:

| Logic type | Where it lives |
| --- | --- |
| Async operations (API calls, fetch, polling) | A custom hook in `src/hooks/` that dispatches to Redux |
| Multi-step side effects (relay job → response mapping) | A hook; the hook dispatches actions, the component reads selectors |
| Shared mutable state (loading flags, response data) | A Redux slice — components read via `useAppSelector`, write via `dispatch` |
| Pure UI state (controlled input value, hover, open/closed) | `useState` local to the component |

**The test:** if you need to inline an `async` function, a multi-branch `if/else`, or more than ~3 lines of data transformation inside a component body or event handler, extract it.

```typescript
// ❌ Wrong — business logic inline in a component
const handleSend = async () => {
  setLoading(true)
  try {
    const response = await fetch(url, { method, headers, body })
    setResponse({ status: response.status, body: await response.text() })
  } catch (e) {
    setResponse({ status: 0, body: String(e) })
  } finally {
    setLoading(false)
  }
}

// ✅ Correct — logic in a hook, component only calls it
const { sendRequest } = useSendRequest()
const handleSend = () => sendRequest({ url, method, headers, body })
```

**Hooks that dispatch:** a custom hook may call `useAppDispatch()` and dispatch to Redux slices. This is the preferred pattern for async logic that produces shared state — the hook owns the async work, Redux owns the result.

```typescript
// src/hooks/useSendRequest.ts
export function useSendRequest() {
  const dispatch = useAppDispatch()
  const sendRequest = useCallback(async (params) => {
    dispatch(setIsSendingRequest(true))
    // ... fetch logic ...
    dispatch(setRequestResponse(result))
    dispatch(setIsSendingRequest(false))
  }, [dispatch])
  return { sendRequest }
}

// src/pages/MyPage.tsx
const { sendRequest } = useSendRequest()
const isSending = useAppSelector(selectIsSendingRequest)
const response = useAppSelector(selectRequestResponse)
```

### Action creator registry

Every Redux action creator in this app must be registered via `actionRegistry.registerAll()` (from `src/store/actionMeta.ts`). This:

1. Attaches metadata (`description`, `area`, `group`) directly onto each action creator function.
2. Adds every action creator to a queryable list so AI agents and developer tooling can discover all available actions at runtime without parsing source code.
3. Returns the same actions object typed as `RegisteredAction<T>` for destructuring into named exports.

### Enums

**`ActionArea`** — the top-level functional domain:

| Value                 | Used for                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `ActionArea.Request`  | Building, configuring, or sending a request (API tester UI, params, headers, etc.).      |
| `ActionArea.Response` | Viewing or analysing a response (JSON viewer, table viewer, filters, columns).           |
| `ActionArea.Export`   | Exporting data from the portal (downloads, clipboard, share links).                      |
| `ActionArea.UI`       | General UI chrome not tied to a specific domain (modals, toasts, themes, global layout). |

**`ActionGroup`** — logical sub-group within an area (defined in `actionMeta.ts`):

| Value                      | Area       | Used for                                                                     |
| -------------------------- | ---------- | ---------------------------------------------------------------------------- |
| `ActionGroup.Navigation`   | `Request`  | Tab and panel selection in the API tester.                                   |
| `ActionGroup.Layout`       | `Request`  | Section collapse/expand state.                                               |
| `ActionGroup.SendRequest`  | `Request`  | In-flight state and response result for the active API request.              |
| `ActionGroup.ViewMode`     | `Response` | Top-level view selector and cross-view settings (e.g. highlight duplicates). |
| `ActionGroup.Json`         | `Response` | JMESPath filtering, truncation, unique filter, and bulk JSON state.          |
| `ActionGroup.Table`        | `Response` | SQL query, join configuration.                                               |
| `ActionGroup.TableColumns` | `Response` | Column visibility, sort order, column reconciliation.                        |

When adding a new group, add a value to the `ActionGroup` enum in `actionMeta.ts` — do not use raw strings.

### `ActionMeta` fields

| Field         | Type          | Purpose                                                               |
| ------------- | ------------- | --------------------------------------------------------------------- |
| `description` | `string`      | Plain-English explanation of what the action does and when to use it. |
| `area`        | `ActionArea`  | Functional domain the action belongs to.                              |
| `group`       | `ActionGroup` | Logical sub-group within the area.                                    |

### Adding a new action

1. Define the reducer inside `createSlice` as normal.
2. Pass `slice.actions` to `actionRegistry.registerAll()` and provide an `ActionMeta` entry for **every** key — TypeScript will error if any are missing or misspelled.
3. Destructure the return value into named exports.
4. Export `reducer` **after** the `registerAll` call.

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { actionRegistry, ActionArea, ActionGroup } from './actionMeta'

const mySlice = createSlice({
  name: 'mySlice',
  initialState,
  reducers: {
    myAction(state, action: PayloadAction<string>) {
      state.value = action.payload
    },
    myOtherAction(state) {
      state.active = !state.active
    },
  },
})

export const { myAction, myOtherAction } = actionRegistry.registerAll(mySlice.actions, {
  myAction: {
    description: 'Sets the current value.',
    area: ActionArea.Response,
    group: ActionGroup.ViewMode,
  },
  myOtherAction: {
    description: 'Toggles the active state.',
    area: ActionArea.Response,
    group: ActionGroup.ViewMode,
  },
})

export const myReducer = mySlice.reducer

// Selectors
export const selectValue = (state: RootState) => state.mySlice.value

// In a component
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { myAction, selectValue } from '@/store/mySlice'

const value = useAppSelector(selectValue)
const dispatch = useAppDispatch()
dispatch(myAction('new value'))
```

### Querying the registry

```typescript
import { actionRegistry, ActionArea, ActionGroup } from '@/store/actionMeta'

// All registered action creators
actionRegistry.all

// Filter by area
actionRegistry.byArea(ActionArea.Response)

// Filter by group
actionRegistry.byGroup(ActionGroup.TableColumns)

// Inspect an individual action creator
myAction.description // string
myAction.area // ActionArea
myAction.group // ActionGroup
```

## Component Conventions

### File structure

- **One component per file — no exceptions.** Filename must match the exported component name exactly (e.g. `UserCard.tsx`).
- **Sibling files over sub-directories.** Extracted components live next to the file they came from (e.g. `JMESPathInputRow.tsx` alongside `MaximizableCodeViewer.tsx`), not in a generic `components/` subdirectory.
- **Group related components in a folder** with an `index.ts` barrel export when a feature grows to multiple sibling files.
- **Pure helpers travel with their consumer.** Utility functions used only by one component live in that component's file (or a sibling `*-utils.ts`).

### Size and extraction

- **Max ~300–400 lines per file.** If a component grows beyond this, extract sub-components.
- **Extract into its own file** when a JSX block exceeds ~40–50 lines, has its own internal state or effects, is reused in more than one place, or has a clear nameable responsibility (e.g. `AvatarWithBadge`, `PricingCard`).
- **No inline render functions longer than ~20 lines.** Extract them into named components in sibling files.
- **Pass only what's needed as props.** Don't hoist state unnecessarily; the parent owns shared state, children own their own.

### Composition over nesting

- **Parent components should read like a high-level outline.** Their JSX should be composed of named child components, not raw HTML elements.
- **No more than 2–3 levels of JSX nesting** inside a single `return` — extract the inner levels into named components.
- **Split data-fetching from rendering.** A component that fetches data and renders it should be split into a container (fetch logic) + presentational component (render only).

### Prefer components over inline JSX blocks

**Extract named JSX blocks into components rather than inlining them inside containers.** A container like `<CardContent>` should reference named components, not contain raw markup.

```typescript
// ❌ Wrong — verbose nested markup inside a container
<CardContent>
  <div className="space-y-4">
    <div>
      <h4 className="text-sm font-medium mb-2">Request Volume</h4>
      <div className="h-48 flex items-center justify-center border border-border rounded-lg bg-muted/20">
        <p className="text-muted-foreground">Chart coming soon</p>
      </div>
    </div>
    <div>
      <h4 className="text-sm font-medium mb-2">Response Time Trends</h4>
      <div className="h-48 flex items-center justify-center border border-border rounded-lg bg-muted/20">
        <p className="text-muted-foreground">Chart coming soon</p>
      </div>
    </div>
  </div>
</CardContent>

// ✅ Correct — named components, container reads like an outline
const RequestVolumeChart = () => (
  <div>
    <h4 className="text-sm font-medium mb-2">Request Volume</h4>
    <div className="h-48 flex items-center justify-center border border-border rounded-lg bg-muted/20">
      <p className="text-muted-foreground">Chart coming soon</p>
    </div>
  </div>
)

const ResponseTimeTrendsChart = () => (
  <div>
    <h4 className="text-sm font-medium mb-2">Response Time Trends</h4>
    <div className="h-48 flex items-center justify-center border border-border rounded-lg bg-muted/20">
      <p className="text-muted-foreground">Chart coming soon</p>
    </div>
  </div>
)

<CardContent>
  <div className="space-y-4">
    <RequestVolumeChart />
    <ResponseTimeTrendsChart />
  </div>
</CardContent>
```

**Minimum size:** a component must be at least 4–5 lines. Don't extract single-element wrappers into their own components — the overhead outweighs the benefit.

**Reduce duplication with factory functions.** When multiple components share the same structure and differ only in data (labels, configs), write a factory or higher-order component rather than copy-pasting:

```typescript
// ✅ Factory reduces repetition when structure is identical
const createChartPanel = (title: string) => () => (
  <div>
    <h4 className="text-sm font-medium mb-2">{title}</h4>
    <div className="h-48 flex items-center justify-center border border-border rounded-lg bg-muted/20">
      <p className="text-muted-foreground">Chart coming soon</p>
    </div>
  </div>
)

const RequestVolumeChart = createChartPanel('Request Volume')
const ResponseTimeTrendsChart = createChartPanel('Response Time Trends')
```

### Design doc references

Hook and component files that implement a formal design document carry a `@designDoc` tag in their file-level JSDoc block. When editing one of these files, check the linked design doc and update it if the change alters the designed behaviour or UI contract. See `.claude/rules/design-sync.md`.

### Anti-patterns to avoid

- A single `.tsx` file exceeding ~500 lines without a clear reason.
- Inline anonymous components (`const Item = () => <div>...` defined inside another component's file) — these are components; give them their own file.
- A single exported file with multiple exported components.
- Dumping all logic into one parent and passing dozens of props through layers — co-locate instead.

### Building new components

When building a component:
1. **Plan the component tree first** — before writing any JSX, list the sub-components and their responsibilities.
2. **If you anticipate the component will exceed ~100 lines, name and sketch all sub-components first.** Do not start writing a large component and plan to split it later — decompose before you write.
3. Create each sub-component in its own file.
4. **If a component grows past ~150 lines during implementation, stop immediately and extract** — do not finish the large version and refactor later. The extraction cost is lowest when the context is still fresh.

### Naming

- **PascalCase** for component files and component names: `DashboardHeader.tsx`, `OpenAPIParameterForm.tsx`.
- **Props interface** named `<ComponentName>Props`.
- **Hooks**: `camelCase` prefixed with `use`.
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

## IndexedDataTable Convention

All data tables in the **API detail view tabs** (Versions, Operations, Servers, Parameters, Models) must follow this convention. It is derived from `src/components/api-tester/TableViewPanel.tsx`, which is the reference implementation.

### Required behaviours

**Sortable columns**
- Every sortable column header is clickable. Click once → sort asc; click again → sort desc.
- The active sort column shows `ArrowUp` (asc) or `ArrowDown` (desc) from `lucide-react`. Inactive sortable columns show `ArrowUpDown` at reduced opacity.
- Sort is **server-side**: clicking dispatches a new OpenSearch query with updated `sort` + `order` params. There is no client-side sort.

**Hideable columns**
- Hideable columns show an `EyeOff` icon button on header hover. Clicking hides the column **client-side**.
- When one or more columns are hidden, a banner appears above the table: `N column(s) hidden — Show all`. "Show all" restores all columns.
- Column visibility lives in Redux — it survives tab switches.

**Status bar**
- A fixed bar at the bottom of the table shows the row count: `{from+1}–{from+size} of {total} {entity}` when paginated, or `{total} {entity}` for small result sets.
- When a search or filter is active, show `{returned}/{total} {entity}`.

**Row index column**
- Include a leading `#` column (monospace, muted) showing the 0-based row index. Not sortable, not hideable.

**Pagination controls**
- `< Prev | Page N of M | Next >` bar directly beneath the status bar.
- OpenSearch defaults: `size=10`, `from=0`. Maximum `size=100`.

### Redux state shape (per tab)

Each tab has its own Redux slice. The state shape follows this pattern:

```typescript
interface SomeTabState {
  sort: { field: string; direction: 'asc' | 'desc' }
  hiddenColumns: string[]     // column field names
  page: number                // 0-based
}
```

The tab slice exports selectors `selectSort`, `selectHiddenColumns`, `selectPage` that the tab component reads via `useAppSelector`.

### What NOT to do

- Do not filter data client-side from a pre-loaded array — all filtering and sorting must go to OpenSearch.
- Do not invent a local sort state — always reflect what the server returned.
- Do not skip the status bar — it is part of the convention.

---

## TypeScript Conventions

### Prefer lookup objects over nested ternaries

When mapping a value to one of several outcomes, use a dictionary (object literal) instead of nested ternary chains. Nested ternaries are hard to read and easy to break when new cases are added.

```typescript
// ✅ Correct — flat, easy to extend
const COLOR_FOR_METHOD: Record<string, string> = {
  GET: 'text-green-500',
  POST: 'text-yellow-500',
  PUT: 'text-blue-500',
  DELETE: 'text-red-500',
}
return COLOR_FOR_METHOD[method] ?? 'text-gray-500'

// ❌ Wrong — nested ternaries
method === 'GET'
  ? 'text-green-500'
  : method === 'POST'
    ? 'text-yellow-500'
    : method === 'PUT'
      ? 'text-blue-500'
      : 'text-red-500'
```

This applies to any value-to-value mapping: colours, labels, icons, config keys, etc. Use `Record<string, T>` and a `?? fallback` for the default case.

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
pnpm run dev        # Dev server on port 8080
pnpm run build      # Production build
pnpm run build:dev  # Dev build
pnpm run preview    # Preview production build
pnpm run lint       # ESLint
pnpm run test       # Vitest
pnpm run test:watch
```

Environment variables: copy `.env.example` → `.env` and fill in values.
