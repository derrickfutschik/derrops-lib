# Documentation Workflow Rules

Apply these rules when creating, editing, or deciding where to place documentation under `apps/slaops-docs/`.

## Three-tier doc hierarchy

| Tier                      | Location                    | Purpose                                                                        |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| **Ideas**                 | `internal/platform/drafts/` | Raw, unstructured ideas, research notes, hypotheses                            |
| **Designs (in progress)** | `internal/platform/design/` | Formal design docs being actively written — `status: draft`                    |
| **Designs (progressing)** | `internal/platform/design/` | Reviewed designs — `status: proposed \| accepted \| implemented \| superseded` |

Rules:

- `drafts/` is an **ideas inbox**. A file there means "raw idea, not yet designed."
- `design/` holds all formal design work regardless of maturity. Never park a design-in-progress in `drafts/` — use `status: draft` in `design/` instead.
- Use the `/idea` skill to create idea docs and the `/design` skill to create design docs.

## Design status lifecycle

```
draft → proposed → accepted → implemented → superseded
```

| Status        | Meaning                                      | Action required                                         |
| ------------- | -------------------------------------------- | ------------------------------------------------------- |
| `draft`       | Being actively written, not ready for review | —                                                       |
| `proposed`    | Ready for design review                      | —                                                       |
| `accepted`    | Approved, implementation in progress         | —                                                       |
| `implemented` | Feature shipped to production                | Set `implemented_at: YYYY-MM-DD`; add `implemented` tag |
| `superseded`  | Replaced by a newer design                   | Link to the successor doc in the body                   |

Update `updated_at` on every meaningful edit to a design doc.

## Idea → Design promotion (search-first rule)

When starting a new design with `/design`, always search `internal/platform/drafts/` for related ideas **before** creating the design file. If a relevant idea exists:

1. Absorb its content and open questions into the new design doc
2. Delete the idea file — it is no longer an idea, it is a concrete design
3. Note the idea's origin in the design doc's "Background" or "Context" section

This prevents `drafts/` from accumulating stale ideas that have been silently superseded by real designs.

## UI changes → quickstart sync

When any change affects a user-visible portal flow (login, relay setup, Aegis configuration, API tester, dashboard):

1. Identify the affected guide in `apps/slaops-docs/public/docs/quickstart/`
2. Update step numbering, command examples, and any screenshot references
3. If a new top-level UI feature is added, create a new quickstart guide and register it in the quickstart index

## Changelog / release

When tagging a release, follow the full checklist in `apps/slaops-docs/changelog/CLAUDE.md`. Use the `/release` skill for a guided walkthrough.

## Note on `design/CLAUDE.md` line 132

That file currently references `apps/slaops-docs/notes/` for speculative ideas — this location does not exist. The correct location is `internal/platform/drafts/`. This rule takes precedence.
