# JMESPath Auto-Complete

## High Level Algorithm

- 0.  Parse the current expression and return the JSON (or return JSON if no expression specified yet)
- 1.  Extract all wildcard-only paths from a JSON value
- 2.  Fuzzy search those paths (case-insensitive, space-separated terms)
- 3.  Return the paths sorted by relevance (shorter paths first, then alphabetical)
- 4.  Keep those as the options until a new valid expression is entered, and then go back to 0.


## Autocomplete Strategy (as the user types)

Two strategies run in order of preference. The first one that produces results wins.

### Strategy 1 — Eval-based (most accurate for partial completions)

Triggered when the current query evaluates to a **non-null object** (not an array).

1. Strip a trailing `.` or `[` from the query so partial typing still works
   (e.g. `hits[2].document.` → strip → `hits[2].document`).
2. Evaluate the stripped query against the root JSON using `jmespath.search`.
3. If the result is a non-null, non-array object, call `extractWildcardPaths` on
   it to get all child paths (arrays become `[*]` — never `[0]`).
4. Prepend the evaluated query + separator (`.` or nothing if path starts with `[`)
   to each child path to form the suggestion list.

**Example**: user has typed `hits[2].document`
- Evaluate → `{ name: "Doc", tags: ["a","b"] }`
- Child paths → `name`, `tags[*]`
- Suggestions → `hits[2].document.name`, `hits[2].document.tags[*]`

Array results fall through to Strategy 2; the fuzzy search handles `[*]` paths
from the root more accurately for arrays.

### Strategy 2 — Fuzzy search against root paths (fallback)

Used when Strategy 1 does not apply (empty query, eval fails, or result is an array).

1. `extractWildcardPaths(rootJson)` walks the full JSON once and emits every
   dot-separated path, substituting `[*]` for every array traversal.
2. `removeBareArrayPaths` removes a path if a longer `path[*]` variant exists
   (avoids showing redundant parent nodes).
3. `fuzzySearchPaths(allPaths, query)`:
   - If the query contains numeric indices (e.g. `hits[0].document`), normalise
     them to `[*]`, do a **prefix match** against the stored paths, then
     substitute the original expression back into each result so suggestions
     show the real indices the user typed.
   - Otherwise, treat the query as one or more space-separated terms and keep
     every path that contains **all** terms (case-insensitive substring match).
4. Sort by length ascending (shorter = more specific), then alphabetically.
5. Return up to 15 results, hiding the list if the only suggestion is an exact
   match of the current query.

**Options always use `[*]`** regardless of view mode.  The table-view flattening
(see below) is a separate, invisible concern and never leaks into the suggestions.


## Table-View Array Flattening (invisible to the user)

When the user switches to **Table view**, the raw JMESPath result may be an
**array-of-arrays** that the table cannot display directly as rows.  Rather than
appending `[]` or `[*][]` to the user's visible query, the system selects the
best effective query under the hood and passes its flattened output to the table.
The input field always shows the user's original expression unchanged.

### Decision algorithm (`tableQuery` memo)

Only active in table view with an active JMESPath filter.

1. Evaluate the user's query → parse `displayContent`.
2. If the result is **not** an array-of-arrays (`Array.isArray(parsed[0])` is
   false), no adjustment is needed — use the query as-is.
3. Flatten the outer array one level: `displayParsed.flat()`.  The flat row
   count is the same for all candidate suffixes.
4. Run `detectJoiningContext` for three candidate queries and record how many
   **joining columns** each would produce:

   | Candidate          | Example                                        | Typical result               |
   |--------------------|------------------------------------------------|------------------------------|
   | `query` (as-is)    | `hits[*].document.sampleOperations[*]`         | 0–1 cols (count mismatch)    |
   | `query + '[]'`     | `hits[*].document.sampleOperations[*][]`       | N cols (adds one level)      |
   | `query + '[*][]'`  | `hits[*].document.sampleOperations[*][]`       | N+1 cols (adds two levels)   |

   The `[*][]` suffix is valuable when the query **does not already end in `[*]`**
   because the extra `[*]` creates one additional trackable traversal segment,
   yielding one more joining column.

5. Pick the candidate with the **most joining columns**.  Ties are broken in
   favour of the shorter suffix (`query` > `query+[]` > `query+[*][]`).

### Examples

| User query                                  | Result shape        | tableQuery chosen                            | Join cols |
|---------------------------------------------|---------------------|----------------------------------------------|-----------|
| `hits[*].document.sampleOperations`         | `[[op,op],[op]]`    | `hits[*].document.sampleOperations[*][]`     | 2         |
| `hits[*].document.sampleOperations[*]`      | `[[op,op],[op]]`    | `hits[*].document.sampleOperations[*][]`     | 2         |
| `hits[*].document.sampleOperations[*][]`    | `[op,op,op]`        | unchanged (already flat)                     | 2         |
| `hits[*].document`                          | `[{…},{…}]`         | unchanged (not array-of-arrays)              | 0         |
| `hits[*].doc.ops[*].paths`                  | `[[p,p],[p]]`       | `hits[*].doc.ops[*].paths[*][]`              | 3         |

### Why joining columns matter

Each joining column adds a synthetic column to the table (e.g. `hits`, `ops`)
whose value is the positional index (or a chosen scalar attribute) of the
ancestor element.  More joining columns = more context visible per row without
losing information about which parent record each row came from.

`detectJoiningContext` parses the query string into array-traversal *segments*;
`joiningColumns.length = segments.length - 1`.  The last segment produces rows;
all earlier segments produce joining columns.  Appending `[]` adds one more
segment (anonymous, label `#N`); appending `[*][]` adds two more.

### `tableDisplayContent`

Once `tableQuery` is chosen, `tableDisplayContent` is computed as:
- `tableQuery === debouncedQuery` → pass `displayContent` to `TableViewPanel` unchanged.
- Otherwise → `JSON.stringify(displayParsed.flat(), null, 2)`.

`joiningContext` and `joinColumnCandidates` are then derived from `tableQuery`
and `tableDisplayContent`, so the join-column UI in the table always reflects
the effective (possibly suffix-adjusted) query.
