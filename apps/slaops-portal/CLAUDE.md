# slaops-portal

React web portal for monitoring SLA compliance, API performance, and cost analysis.

- **Tech**: React 18 · Vite · TypeScript · Redux Toolkit · shadcn/ui · AWS Amplify (Cognito)
- **Dev port**: 8080

---

## Redux conventions

### Action creator metadata

Every exported Redux action creator **must** have metadata attached via `attachMeta` (from `src/store/actionMeta.ts`). This embeds context directly on the function so AI agents and developer tooling can inspect available actions at runtime without parsing source code.

**Required fields** (`ActionMeta`):

| Field | Type | Purpose |
|---|---|---|
| `description` | `string` | Plain-English explanation of what the action does and any side effects. |
| `area` | `ActionArea` | Functional domain the action belongs to (see below). |
| `group` | `string` | Logical sub-group within the area for finer-grained categorisation. |

**`ActionArea` values**:

| Value | Used for |
|---|---|
| `'request'` | Building, configuring, or sending a request (API tester UI, params, headers, etc.). |
| `'response'` | Viewing or analysing a response (JSON viewer, table viewer, filters, columns). |
| `'export'` | Exporting data from the portal (downloads, clipboard, share links). |
| `'ui'` | General UI chrome not tied to a specific domain (modals, toasts, themes, layout). |

**`group` values** (extend as needed, keep kebab-case):

| Group | Area | Used for |
|---|---|---|
| `'navigation'` | `request` | Tab and panel selection in the API tester. |
| `'layout'` | `request` | Section collapse/expand state. |
| `'view-mode'` | `response` | Top-level view selector and cross-view settings (e.g. highlight duplicates). |
| `'json'` | `response` | JMESPath filtering, truncation, unique filter, and bulk JSON state. |
| `'table'` | `response` | SQL query, join configuration. |
| `'table-columns'` | `response` | Column visibility, sort order, column reconciliation. |

### Adding a new action

1. Define the reducer inside `createSlice` as normal.
2. Destructure the action creator from `slice.actions`.
3. Call `attachMeta` immediately after the destructure block — **before** `export const reducer`.

```typescript
import { attachMeta } from './actionMeta'

// … createSlice …

export const { myNewAction } = mySlice.actions

attachMeta(myNewAction, {
  description: 'What this action does and when to use it.',
  area: 'response',
  group: 'table',
})

export const myReducer = mySlice.reducer
```

### Consuming metadata (e.g. in an AI tool)

```typescript
import * as actions from '@/store/responseViewerSlice'

// List all actions grouped by area
const byArea = Object.values(actions)
  .filter((v): v is typeof v & { area: string } => typeof v === 'function' && 'area' in v)
  .reduce((acc, fn) => {
    acc[fn.area] ??= []
    acc[fn.area].push({ name: fn.name, description: fn.description, group: fn.group })
    return acc
  }, {} as Record<string, unknown[]>)
```

---

## File structure

```
src/
├── store/
│   ├── actionMeta.ts          # ActionMeta type + attachMeta helper
│   ├── apiTesterSlice.ts      # Request-building UI state
│   ├── responseViewerSlice.ts # Response viewer state
│   ├── hooks.ts               # Typed useAppDispatch / useAppSelector
│   └── index.ts               # Store configuration + RootState / AppDispatch types
├── components/
└── …
```

---

## Commands

```bash
pnpm run dev        # Start dev server on :8080
pnpm run build      # Production build
pnpm run build:dev  # Development build
pnpm run preview    # Preview production build
pnpm run lint       # ESLint
```
