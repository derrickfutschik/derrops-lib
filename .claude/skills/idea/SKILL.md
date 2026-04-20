# /idea — Capture an Idea

Captures a raw idea, research note, or hypothesis in `apps/slaops-docs/internal/platform/drafts/`.

## When to use

Use `/idea` when you have an unstructured thought, research finding, or "what if" that is not yet ready to be a formal design. Ideas live in `drafts/` until deliberately promoted to a design via `/design`.

## Steps

1. **Get a title** — use the argument provided, or ask: "What is the title of this idea?"
2. **Derive the filename** — lowercase-hyphenated title, e.g. "BYOK Token Rotation" → `byok-token-rotation.md`
3. **Check for duplicates** — scan `internal/platform/drafts/` for files with similar names; if one exists, ask whether to update it instead of creating a new file
4. **Create the file** in `apps/slaops-docs/internal/platform/drafts/` using the template below
5. **Confirm** — tell the user the file path and remind them to use `/design` when they are ready to formalise it

## Frontmatter template

```yaml
---
id: { filename-without-extension }
title: { Human Readable Title }
created_at: { YYYY-MM-DD }
updated_at: { YYYY-MM-DD }
author: { GitHub handle or name }
tags:
  - idea
  - { one-topic-hint — prefer tags from design/tags.yml where applicable }
---
```

## Body template

```markdown
## Problem / Opportunity

[One paragraph: what problem or opportunity this addresses]

## Notes

[Unstructured notes, links, references, rough sketches]

## Open Questions

- [ ] ...

## Next Steps

When this idea is ready to become a formal design, run `/design` to:

- Search for related ideas and absorb them
- Create a properly-structured design doc in `internal/platform/design/`
- Register it in `design/index.md`
- Delete this idea file
```

## Rules

- Do **not** add a `draft` tag — the file's location in `drafts/` already signals WIP
- Do **not** add `sidebar_label` or `sidebar_position` — those are design doc fields
- Keep it lightweight — an idea doc should take minutes to create, not hours
