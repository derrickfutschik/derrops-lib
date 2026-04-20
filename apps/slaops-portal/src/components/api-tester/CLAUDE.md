# api-tester Components

## Component Size and Composition

**Keep components focused and small.** Each file should do one thing well. When a component grows beyond ~300–400 lines, or contains a large inline render function (e.g. `const fooRow = () => <div>...195 lines...</div>`), extract it into its own sibling file.

### Rules

- **No inline render functions** that span more than ~20 lines. Extract them into named components in sibling files.
- **Extract by responsibility.** If a chunk of JSX has its own local state, refs, and callbacks, it belongs in its own component file.
- **Sibling files over barrel files.** Extracted components live next to the file they came from (e.g. `JMESPathInputRow.tsx` alongside `MaximizableCodeViewer.tsx`), not in a generic `components/` subdirectory.
- **Pass only what's needed as props.** The parent owns shared state (e.g. undo stacks); the child owns its own state (e.g. input history). Don't hoist state unnecessarily.
- **Pure helpers travel with their consumer.** Module-level utility functions used only by one component move to that component's file when extracting.

### Anti-patterns to avoid

- A single `.tsx` file exceeding ~500 lines without a clear reason.
- Inline JSX functions assigned to variables (`const jmespathRow = (ref, overlay) => <div>...</div>`) — these are components; make them components.
- Dumping all logic into one parent and passing dozens of props/refs through layers — prefer co-location.

---

## Keyboard Shortcuts

When adding new keyboard shortcuts to any component in this directory (e.g. `MaximizableCodeViewer.tsx`, `JsonResponseViewer.tsx`), you **must** also update [`HotkeyInfoDialog.tsx`](./HotkeyInfoDialog.tsx) to document the new shortcut.

`HotkeyInfoDialog.tsx` is the single source of truth for what shortcuts are shown to the user via the `⌘H` popup and the keyboard icon button in the viewer header.

### How to add a shortcut

1. Implement the handler in the relevant component.
2. Open `HotkeyInfoDialog.tsx` and add a `[key, description]` tuple to the appropriate section in the `SECTIONS` array:
   - **JSON Viewer** — shortcuts that work when the viewer content area is focused
   - **JMESPath Input** — shortcuts that work when the JMESPath input is focused
   - **Viewer Controls** — toolbar buttons and layout controls

### Current shortcuts

| Key            | Action                                                     | Section         |
| -------------- | ---------------------------------------------------------- | --------------- |
| `⌘ K`          | Toggle Highlight Mode                                      | JSON Viewer     |
| `⌘ J`          | Toggle Filter Mode                                         | JSON Viewer     |
| `⌘ 8`          | Wildcard array indices (`[0]` → `[*]`)                     | JSON Viewer     |
| `⌘ I`          | Toggle value truncation (click individual value to expand) | JSON Viewer     |
| `⌘ U`          | Filter duplicate values (arrays only)                      | JSON Viewer     |
| `⌘ A`          | Select all content                                         | JSON Viewer     |
| `⌘ Click`      | Use value as JMESPath expression                           | JSON Viewer     |
| `↑ / ↓`        | Browse query history                                       | JMESPath Input  |
| `Enter`        | Save query to history                                      | JMESPath Input  |
| `Esc`          | Close history / revert query                               | JMESPath Input  |
| `Double-click` | Show query history                                         | JMESPath Input  |
| `↔`           | Expand to bottom panel                                     | Viewer Controls |
| `⤢`            | Maximize / fullscreen                                      | Viewer Controls |
| `⌘ H`          | Show keyboard shortcuts popup                              | Viewer Controls |
