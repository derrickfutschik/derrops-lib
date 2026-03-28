# Conventions

- SQL Table Names & Columns are in snake_case
- SQL Table Names should be singular

## Mermaid Diagrams

### Node label text

- `\n` does **not** create a newline — it renders as the literal characters `\n`. Never use it.
- To create a real line break inside a node label, use `<br/>` inside a quoted string:
  ```
  A["line one<br/>line two"]
  ```
- Any node label containing special characters **must** be wrapped in double quotes:
  ```
  A["POST /api/foo (201)"]
  ```
- Special characters that **break unquoted labels** and require quoting:
  - `(` `)` — parentheses
  - `:` — colon (also used in edge label syntax)
  - `#` — hash
  - `>` — angle bracket
  - `-` at the start of a word — can be misread as an arrow fragment
- Do not use double quotes (`"`) inside an already-quoted label — there is no escape sequence; rephrase to avoid them.
- Backticks create a **monospace/code styled** label (supported in newer Mermaid): `` A[`code style`] ``

### Node IDs

- Node IDs must be alphanumeric or use underscores — no spaces, hyphens, or punctuation.
- Keep IDs short and descriptive; they are not shown in the rendered diagram unless there is no label.

### Edge labels

- Edge labels go between pipes: `A -->|label text| B`
- Colons and parentheses in edge labels also require quoting the whole edge label in some renderers — prefer plain words.

### Subgraphs

- The subgraph title must be on the same line as the `subgraph` keyword:
  ```
  subgraph Customer Infrastructure
      A
  end
  ```
- Subgraph titles do not support `<br/>` — keep them to a single short line.

### General

- Docusaurus uses `@docusaurus/theme-mermaid`; always use a fenced code block tagged `mermaid`.
- Comments use `%%`: `%% this is a comment`
- Prefer `flowchart` over `graph` — `flowchart` is the current syntax and supports more features.
- Declare direction on the first line: `flowchart TD` (top-down), `flowchart LR` (left-right).
- Keep node labels short — long labels cause layout overflow on narrow screens.
