---
description: Mermaid diagram authoring rules — apply when writing or editing Mermaid diagram code blocks
---

# Mermaid Authoring Rules

Violations of these rules cause **silent render failures** — the diagram simply doesn't appear.

## Rules

1. **Quote labels with special characters** — participant/actor labels containing parentheses, brackets, or colons must be quoted:
   - ✅ `participant Foo as "Foo Service (v2)"`
   - ❌ `participant Foo as Foo Service (v2)`

2. **Keep node IDs simple** — use only letters, digits, and underscores for node/participant IDs; put human-readable text in the `as "..."` alias:
   - ✅ `participant RelayConn as "Relay Connection"`
   - ❌ `participant Relay Connection`

3. **No semicolons in message labels** — Mermaid treats `;` as a statement terminator, causing a parse error on the following line. Use a comma or em dash instead:
   - ✅ `A->>B: Connect, then authenticate`
   - ❌ `A->>B: Connect; then authenticate`
