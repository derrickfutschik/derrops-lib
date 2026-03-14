# api-tester Components

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

| Key | Action | Section |
|-----|--------|---------|
| `⌘ K` | Toggle Highlight Mode | JSON Viewer |
| `⌘ J` | Toggle Filter Mode | JSON Viewer |
| `⌘ 8` | Wildcard array indices (`[0]` → `[*]`) | JSON Viewer |
| `⌘ A` | Select all content | JSON Viewer |
| `⌘ Click` | Use value as JMESPath expression | JSON Viewer |
| `↑ / ↓` | Browse query history | JMESPath Input |
| `Enter` | Save query to history | JMESPath Input |
| `Esc` | Close history / revert query | JMESPath Input |
| `Double-click` | Show query history | JMESPath Input |
| `↔` | Expand to bottom panel | Viewer Controls |
| `⤢` | Maximize / fullscreen | Viewer Controls |
| `⌘ H` | Show keyboard shortcuts popup | Viewer Controls |
