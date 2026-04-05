# slaops-portal

React web portal for monitoring SLA compliance, API performance, and cost analysis.

- **Tech**: React 18 · Vite · TypeScript · Redux Toolkit · shadcn/ui · AWS Amplify (Cognito)
- **Dev port**: 8080

---

## Redux conventions

### Action creator registry

Every Redux action creator in this app must be registered via
`actionRegistry.registerAll()` (from `src/store/actionMeta.ts`). This:

1. Attaches metadata (`description`, `area`, `group`) directly onto each action creator function.
2. Adds every action creator to a queryable list so AI agents and developer tooling can discover all available actions at runtime without parsing source code.
3. Returns the same actions object typed as `RegisteredAction<T>` for destructuring into named exports.

### Enums

**`ActionArea`** — the top-level functional domain:

| Value | Used for |
|---|---|
| `ActionArea.Request` | Building, configuring, or sending a request (API tester UI, params, headers, etc.). |
| `ActionArea.Response` | Viewing or analysing a response (JSON viewer, table viewer, filters, columns). |
| `ActionArea.Export` | Exporting data from the portal (downloads, clipboard, share links). |
| `ActionArea.UI` | General UI chrome not tied to a specific domain (modals, toasts, themes, global layout). |

**`ActionGroup`** — logical sub-group within an area (defined in `actionMeta.ts`):

| Value | Area | Used for |
|---|---|---|
| `ActionGroup.Navigation` | `Request` | Tab and panel selection in the API tester. |
| `ActionGroup.Layout` | `Request` | Section collapse/expand state. |
| `ActionGroup.ViewMode` | `Response` | Top-level view selector and cross-view settings (e.g. highlight duplicates). |
| `ActionGroup.Json` | `Response` | JMESPath filtering, truncation, unique filter, and bulk JSON state. |
| `ActionGroup.Table` | `Response` | SQL query, join configuration. |
| `ActionGroup.TableColumns` | `Response` | Column visibility, sort order, column reconciliation. |

When adding a new group, add a value to the `ActionGroup` enum in `actionMeta.ts` — do not use raw strings.

### `ActionMeta` fields

| Field | Type | Purpose |
|---|---|---|
| `description` | `string` | Plain-English explanation of what the action does and when to use it. |
| `area` | `ActionArea` | Functional domain the action belongs to. |
| `group` | `ActionGroup` | Logical sub-group within the area. |

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
myAction.description  // string
myAction.area         // ActionArea
myAction.group        // ActionGroup
```

---

## File structure

```
src/
├── store/
│   ├── actionMeta.ts          # ActionArea/ActionGroup enums, ActionMeta type,
│   │                          #   RegisteredAction type, ActionRegistry class,
│   │                          #   actionRegistry singleton
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
