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

**Options always use `[*]`** regardless of view mode. The table-view flattening
(see below) is a separate, invisible concern and never leaks into the suggestions.

## Table-View Array Flattening (invisible to the user)

When the user switches to **Table view**, the raw JMESPath result may be a
**nested array** (array-of-arrays, or deeper) that the table cannot display
directly as rows. Rather than appending operators to the user's visible query,
the system selects the best effective query under the hood and passes its
flattened output to the table. The input field always shows the user's original
expression unchanged.

### Decision algorithm (`tableQuery` memo)

Only active in table view with an active JMESPath filter.

The algorithm loops one nesting level at a time, choosing the best single-level
suffix at each step, until the result is a flat array.

```
suffix   = ''
current  = displayContent (parsed)

while current[0] is an array:          // still nested
    flattened = current.flat()

    flatCols        = joinCols(query + suffix + '[]',    flattened)
    wildcardFlatCols = joinCols(query + suffix + '[*][]', flattened)

    if wildcardFlatCols >= flatCols:
        suffix  += '[*][]'
    else:
        suffix  += '[]'

    current = flattened

tableQuery = query + suffix             // suffix may be '', '[]', '[*][]',
                                        // '[][*][]', '[*][][*][]', etc.
```

`joinCols(q, data)` = `detectJoiningContext(original, q, data.length)?.joiningColumns.length ?? 0`

A hard cap of 8 iterations prevents pathological infinite loops.

### Why `[*][]` beats `[]` at each level

`detectJoiningContext` parses the query string into array-traversal _segments_;
`joiningColumns.length = segments.length - 1`. The last segment produces rows;
all earlier ones produce joining columns.

- `'[]'` adds one segment → one more joining column.
- `'[*][]'` adds **two** segments → two more joining columns.

The extra `[*]` is only counted when `computeRowIndices` can successfully walk
the data for that segment. When it cannot (e.g. because the elements at that
level are already objects, not arrays), `detectJoiningContext` returns `null`
(0 cols) and `[]` is chosen instead.

### Suffix-building examples

| User query                           | Nesting depth | Suffix chosen                       | tableQuery                      | Join cols |
| ------------------------------------ | ------------- | ----------------------------------- | ------------------------------- | --------- |
| `hits[*].doc.ops`                    | 1             | `[*][]`                             | `hits[*].doc.ops[*][]`          | 2         |
| `hits[*].doc.ops[*]`                 | 1             | `[]`                                | `hits[*].doc.ops[*][]`          | 2         |
| `hits[*].doc.ops[*][]`               | 0             | _(none)_                            | unchanged                       | 2         |
| `hits[*].doc.ops` (ops is `[[[…]]]`) | 2             | `[*][][*][]`                        | `hits[*].doc.ops[*][][*][]`     | 4         |
| `hits[*].doc.ops` (ops is `[[[…]]]`  | 2             | `[*][][]`                           | `hits[*].doc.ops[*][][]`        | 3         |
| — if inner elements are objects)     |               | _(wildcardFlatCols = 0 at level 2)_ |                                 |           |
| `hits[*].doc`                        | 0             | _(none)_                            | unchanged (not array-of-arrays) | 0         |

### `tableDisplayContent`

Once `tableQuery` is chosen, `tableDisplayContent` is computed by iteratively
calling `.flat()` on the parsed `displayContent` until the result is no longer
an array-of-arrays:

```
while current[0] is an array:
    current = current.flat()
tableDisplayContent = JSON.stringify(current)
```

`joiningContext` and `joinColumnCandidates` are then derived from `tableQuery`
and `tableDisplayContent`, so the join-column UI in the table always reflects
the effective (suffix-adjusted) query.

When `tableQuery === debouncedQuery` (no suffix needed), `tableDisplayContent`
equals `displayContent` — no computation wasted.
