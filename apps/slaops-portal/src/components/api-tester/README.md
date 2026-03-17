# api-tester Components

## Architecture Overview

The Response Viewer (`MaximizableCodeViewer.tsx`) manages durable user preferences in the
Redux `responseViewer` slice so they survive request/response cycles. Transient UI state
(dropdown open/close flags, undo/redo stacks, maximize, etc.) stays in local `useState`.

---

## Redux vs Local State Decision Table

| State | Location | Reason |
|-------|----------|--------|
| `selectedView` (json/markdown/table) | Redux | Durable: user sets it once per session |
| `jmespathEnabled/Query/Mode` | Redux | Survives new requests |
| `truncateValues` / `uniqueFilter` | Redux | Durable viewer preferences |
| `sqlQuery` / `sqlMode` | Redux | Durable filter/highlight preference |
| `joinColumn` (first join path) | Redux | Durable join selection |
| `table.columns[*].hidden` | Redux | Column visibility survives requests |
| `table.columns[*].sortDirection` | Redux | Sort preference survives requests |
| `isMaximized` | Local | Transient layout toggle |
| `showHotkeyInfo` | Local | Transient dialog flag |
| `sqlError` | Local | Computed from current SQL execution |
| `sqlHistory` / `sqlHistoryIndex` | Local | Session-only history navigation |
| `showSqlHistory` | Local | Dropdown open/close state |
| `joiningEnabled` | Local | Auto-set from context; not a user pref |
| `additionalJoinPaths[1..]` | Local | Only first join column is persisted |
| `jmespathHistory` / `historyIndex` | Local | Session-only history navigation |
| `showHistory` | Local | Dropdown open/close state |
| undo/redo stacks | Local refs | Session-only edit history |

---

## Component Responsibility Map

| File | Responsibility |
|------|---------------|
| `MaximizableCodeViewer.tsx` | Layout shell, Dialog for fullscreen, all logic and rendering (monolithic for now) |
| `JsonResponseViewer.tsx` | Renders interactive JSON with collapsible nodes and validation highlights |
| `HotkeyInfoDialog.tsx` | Single source of truth for keyboard shortcuts help dialog |
| `joining-utils.ts` | Pure utilities: JMESPath segment parsing, joining context detection, join column candidates |

---

## `reconcileColumns` Contract

When `tableData.columns` changes (new response or new JMESPath filter), the viewer calls:

```typescript
dispatch(reconcileColumns(newColumnIds))
```

This operation:
- **Preserves** `hidden` and `sortDirection` for columns that still exist in the new list.
- **Adds** default prefs (`hidden: false, sortDirection: null`) for new columns.
- **Drops** column prefs for columns no longer present.

This means a user who hid the `id` column will keep it hidden after sending a new request, as long as the response still contains an `id` column.

---

## JMESPath Undo History Lifecycle

The undo/redo stacks live in refs (`undoStackRef`, `redoStackRef`) — they are session-only
and reset when the component unmounts.

Undo is pushed:
1. On **user typing** — debounced 600ms after the last keystroke. The pre-typing value is
   recorded as the "snapshot before this edit burst".
2. On **programmatic query changes** (history navigation, wildcard, Cmd+Click) — immediately,
   pushing the value at the moment of change.

The **history** (query history list) is separate: it is a list of committed queries, persisted
in local state across the component's lifetime. It does not interact with undo.

---

## How to Add a New Viewer Preference to Redux

1. Add the field to `ResponseViewerState` in `src/store/responseViewerSlice.ts`.
2. Add it to `initialState`.
3. Add a `PayloadAction` reducer and export the action creator.
4. Export a selector.
5. In `MaximizableCodeViewer.tsx`:
   - Read via `useAppSelector`.
   - Dispatch the action creator instead of calling `setState`.
6. The preference now survives request/response cycles automatically.

---

## Keyboard Shortcuts

See [`HotkeyInfoDialog.tsx`](./HotkeyInfoDialog.tsx) for the authoritative list of keyboard
shortcuts shown in the `⌘H` popup. When adding new shortcuts, update that file too.
