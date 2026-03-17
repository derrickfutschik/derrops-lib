# api-tester Components

## Architecture Overview

The Response Viewer (`MaximizableCodeViewer.tsx`) manages durable user preferences in the
Redux `responseViewer` slice so they survive request/response cycles. Transient UI state
(dropdown open/close flags, undo/redo stacks, maximize, etc.) stays in local `useState`.

---

## Why Redux (Not Local State) for Viewer Preferences

`MaximizableCodeViewer` **unmounts and remounts between API requests**. In `ApiTester.tsx` the
viewer is inside a ternary: while `isSendingRequest` is `true`, the spinner is shown and
`MaximizableCodeViewer` is not rendered; when the request completes it remounts with the new
response body. Any preference stored in local `useState` is therefore **silently reset to its
initial value on every request**.

Redux survives unmount/remount because the store lives outside the component tree.

### The Bug Pattern to Avoid

```tsx
// ❌ BUG: local state is wiped on every request because the component unmounts
const [myPref, setMyPref] = useState(false)

// ✅ CORRECT: Redux state persists across request/remount cycles
const myPref = useAppSelector(selectMyPref)
const setMyPref = (val: boolean) => dispatch(setMyPrefAction(val))
```

This was the root cause of bugs like "sorting column lost between requests" and
"highlight duplicates reset between requests".

### Secondary Pitfall: Effects That Fire on Mount

Even when a preference *is* in Redux, a `useEffect` that resets it can still fire
on every remount. For example:

```tsx
// ❌ BUG: joiningEnabled starts false on every mount; when it is set to true
// by the joiningContext effect, this runs and clears the Redux sort state.
useEffect(() => {
  if (activeSortColumn) dispatch(setColumnSort({ id: activeSortColumn.id, direction: null }))
}, [joiningEnabled])
```

Because `joiningEnabled` is local state (`useState(false)`), it always starts as `false` on
mount. When the joining context arrives via props, `joiningEnabled` transitions `false → true`,
triggering the effect above and erasing the sort preference stored in Redux.

**Rule:** Any `useEffect` that resets persisted (Redux) state must guard against triggering on
initial mount, or the reset logic must be removed if it is not needed.

---

## Redux vs Local State Decision Table

| State | Location | Reason |
|-------|----------|--------|
| `selectedView` (json/markdown/table) | Redux | Durable: user sets it once per session |
| `highlightDuplicates` | Redux | Survives new requests (component unmounts between requests) |
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

This means a user who sorted by `id` or hid the `id` column will keep that preference after
sending a new request, as long as the response still contains an `id` column.

The sort uses the **column name** (not its index position) to locate the column in the current
data, so adding or removing joining columns (which are prepended) does not break sort.

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

**Never use `useState` for a preference the user sets in the viewer** — if in doubt, use Redux.

---

## Keyboard Shortcuts

See [`HotkeyInfoDialog.tsx`](./HotkeyInfoDialog.tsx) for the authoritative list of keyboard
shortcuts shown in the `⌘H` popup. When adding new shortcuts, update that file too.
