# /design — Create a Design Document

Creates a formal design document in `apps/derrops-docs/internal/platform/design/` with full lifecycle-tracked frontmatter. Always searches for related ideas first.

## When to use

Use `/design` when you are ready to write a formal design — any level of maturity from initial spec to final approved design. Start with `status: draft`; promote through the lifecycle as the design matures.

## Steps

### 1. Gather inputs

Collect (from arguments or by asking):

- **Title** — human-readable name
- **Document type** — `component`, `behaviour`, or `interaction`
- **Domain** — one of: `platform`, `auth`, `oaspec`, `relay`, `logging`, `portal`

### 2. Search for related ideas

Before creating the file, search `apps/derrops-docs/internal/platform/drafts/` for idea docs related to this topic.

If matches are found: present them to the user and ask — "Should I absorb [filename] into this design and delete the idea file?"

If the user confirms absorption: note the idea's origin in the design's "Background" or "Context" section, and delete the idea file from `drafts/` after the design is created.

### 3. Determine the correct subdirectory

| Subdirectory       | Use when                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| `cloud-relay/`     | Domain is `relay`, covers Cloud Relay or Aegis                         |
| `openapi-indexer/` | Domain is `oaspec`                                                     |
| `infrastructure/`  | Domain is `platform`, covers AWS infra, IaC, multi-tenancy, or tagging |
| `process/`         | Tagged `process` — team process standards                              |
| `design/` root     | No existing subdirectory has 4+ related docs for this topic            |

### 4. Derive the filename

Lowercase-hyphenated title. E.g. "Aegis Token Refresh" → `aegis-token-refresh.md`

### 5. Create the file with the lifecycle frontmatter template

```yaml
---
id: { filename-without-extension }
title: { Human Readable Title }
sidebar_label: { Short Sidebar Label — ≤30 characters }
sidebar_position: { integer — check neighbouring files to avoid collisions }
created_at: { YYYY-MM-DD }
updated_at: { YYYY-MM-DD }
implemented_at: ~
author: { GitHub handle or name }
status: draft
tags:
  - { topic-tag from design/tags.yml }
  - { domain-tag: platform|auth|oaspec|relay|logging|portal }
---
```

### 6. Write the body structure

Use the template matching the document type:

**Component design** — Purpose → Problem → Responsibilities → High-level design → Key decisions → Tradeoffs

**Behaviour design** — Context → Trigger → Steps → Error conditions → Sequence diagram

**Interaction design** — Components involved → Contract → Sequence → Trust boundary → Failure modes

### 7. Register in `design/index.md`

Append a one-line entry under the relevant section. Format:

```
- [Title](./subdirectory/filename) — one-sentence description.
```

If the doc lives in a new subdirectory, add a `###` section to `index.md` first.

### 8. Remind about sidebar position

Tell the user: "Check `sidebar_position` relative to neighbouring files in the same subdirectory to avoid ordering conflicts."

## Validating tags

Before finishing, verify tags against `apps/derrops-docs/internal/platform/design/tags.yml`. Tags must be lowercase-hyphenated and present in that file. If a new tag is genuinely needed, add it to `tags.yml` first.

## Reference

- Tag list: `apps/derrops-docs/internal/platform/design/tags.yml`
- Subdirectory format: `_category_.json` + `index.md` required for any new subdirectory
- Full tagging rules: `.claude/rules/doc-tagging.md`
- Lifecycle rules: `.claude/rules/doc-workflow.md`
