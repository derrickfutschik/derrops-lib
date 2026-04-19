# Design Documentation

This directory is the authoritative home for SLAOps platform design. Every component, behaviour, and cross-component interaction that has non-trivial design decisions should have a document here. These docs are **living specifications** — they must be kept in sync with how the platform actually behaves. When the implementation changes, the design doc changes too.

## Purpose

Design docs serve as the specification for the implementation, not a transcript of it. They explain *what* a component does, *why* it is designed that way, and *how* components interact — not line-by-line code. Readers (engineers and AI coding assistants) should be able to understand decisions, constraints, and tradeoffs without reading the source.

Avoid large code blocks. Type signatures and schemas are appropriate to include; full implementations are not.

## What belongs here

| Document type | Description | Example filename |
|---|---|---|
| **Component design** | A component's purpose, responsibilities, high-level design, and key decisions | `component-cloud-relay.md` |
| **Behaviour design** | One specific behaviour within a component that is complex enough to warrant its own doc | `aegis-token-broker-design.md` |
| **Interaction design** | How two or more components interact — contracts, sequences, trust boundaries | `relay-connection.md` |

## Directory structure

Keep documents at the root of `design/` until a group of **4 or more** related docs naturally belong together — then move them into a named subdirectory. Current subdirectories:

| Directory | Contents |
|---|---|
| `cloud-relay/` | Cloud Relay component docs (component, network topology, connection, Aegis, local relay, security) |
| `openapi-indexer/` | OpenAPI indexing pipeline docs |
| `infrastructure/` | Platform-wide AWS infrastructure design docs |
| `process/` | Team process standards (component proposals, etc.) |

When creating a new subdirectory:
1. Add a `_category_.json` (see format below).
2. Add an `index.md` that summarises the subdirectory's documents and links to each.
3. Update `design/index.md` to add a section for the new group.

## Keeping `index.md` up to date

`design/index.md` is the top-level map of all design content. It must be updated whenever:

- A new design document is added (add a bullet or subsection under the relevant group).
- A document is removed or renamed (update or remove the reference).
- A new subdirectory is created (add a `###` section with a brief description and links to each doc inside it).
- A document's scope changes significantly (update its summary sentence).

The index does **not** need to quote or reproduce content — one sentence per document is enough.

## Field Naming Conventions

When writing TypeScript interfaces or code samples in design docs, follow the platform's layer conventions:

| Layer | Convention | Example |
|---|---|---|
| TypeScript | camelCase | `tenantId`, `createdAt`, `tagsText` |
| SQL columns | snake_case | `tenant_id`, `created_at`, `tags_text` |
| OpenSearch fields | camelCase | `tenantId`, `indexedAt`, `hostShape` |

This applies to all interface definitions, query snippets, and prose field references in design docs. Inconsistencies found in existing docs should be fixed as they are encountered.

---

## Tagging conventions

Every design document must include tags in its frontmatter. Tags come from two places:

### Topic tags

Use tags defined in `design/tags.yml`. Common ones:

| Tag | When to use |
|---|---|
| `component-design` | Component or behaviour design docs |
| `architecture` | System-level ADRs and topology docs |
| `security` | Security model, trust boundaries |
| `networking` | Network topology, delivery modes |
| `data-pipeline` | Ingestion, indexing, search |
| `authentication` | Auth protocols — JWT, mTLS, HMAC, IAM |
| `multi-tenant` | Per-tenant isolation design |
| `infrastructure` | AWS infrastructure design |
| `iac` | CDK patterns and constructs |
| `implemented` | Design has a shipped implementation |
| `process` | Team process docs |

### Domain tag

Every document must also carry the domain tag for the area it covers. Domains are defined in [`infrastructure/platform-domains.md`](./infrastructure/platform-domains.md). Add **one** domain tag per document (the primary domain the document belongs to):

| Domain | Tag | When to use |
|---|---|---|
| Platform | `platform` | Core shared infra (VPC, DB, OpenSearch, API Gateway) |
| Auth | `auth` | Identity, Cognito, IAM roles, token issuance |
| OASpec | `oaspec` | OpenAPI spec management, indexing, storage, search |
| Relay | `relay` | Cloud Relay, local relay, Aegis Token Broker |
| Logging | `logging` | Log ingestion, enrichment, storage |
| Portal | `portal` | Web portal, dashboards, metrics UI |

If a document genuinely spans two domains, list both. Avoid adding a third — that is usually a sign the doc should be split.

When adding a new domain, update both `design/tags.yml` and `design/infrastructure/platform-domains.md`.

### Example frontmatter

```yaml
---
id: my-component-design
title: My Component Design
sidebar_label: My Component
sidebar_position: 2
tags:
  - component-design
  - relay
---
```

## Lifecycle frontmatter standard

All design documents must include lifecycle-tracking fields in addition to the Docusaurus fields above. Use the `/design` skill to create new docs with this pre-filled. Update `updated_at` on every meaningful edit.

```yaml
---
id: {filename-without-extension}
title: {Human Readable Title}
sidebar_label: {Short Sidebar Label — ≤30 characters}
sidebar_position: {integer — check neighbouring files}
created_at: {YYYY-MM-DD}
updated_at: {YYYY-MM-DD}
implemented_at: ~          # Set to YYYY-MM-DD when shipped; ~ means not yet implemented
implements: ~              # Set to a YAML list of monorepo-root-relative file paths when implemented
author: {GitHub handle or name}
status: draft              # draft | proposed | accepted | implemented | superseded
tags:
  - {topic-tag from tags.yml}
  - {domain-tag: platform|auth|oaspec|relay|logging|portal}
---
```

### Field rules

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Filename without `.md` extension, lowercase-hyphenated |
| `title` | Yes | Human-readable full title |
| `sidebar_label` | Yes | Short label for sidebar (≤30 characters) |
| `sidebar_position` | Yes | Integer; check adjacent files to avoid ordering collisions |
| `created_at` | Yes | ISO date `YYYY-MM-DD` — set once, never change |
| `updated_at` | Yes | ISO date `YYYY-MM-DD` — update on every meaningful edit |
| `implemented_at` | Yes | ISO date `YYYY-MM-DD` or `~` (YAML null) if not yet shipped |
| `implements` | No | YAML list of monorepo-root-relative paths to implementing files, or `~` if not yet implemented |
| `author` | Yes | GitHub handle or name of the primary author |
| `status` | Yes | See lifecycle below |
| `tags` | Yes | At least one topic tag + exactly one domain tag from `tags.yml` |

### Status lifecycle

```
draft → proposed → accepted → implemented → superseded
```

| Status | Meaning |
|---|---|
| `draft` | Being actively written, not ready for review |
| `proposed` | Ready for design review |
| `accepted` | Design approved, implementation in progress |
| `implemented` | Feature shipped — also set `implemented_at` and add the `implemented` tag |
| `superseded` | Replaced by a newer design — link to the successor doc in the body |

## `_category_.json` format

Every subdirectory needs a `_category_.json`. Follow this pattern:

```json
{
  "label": "Human-readable category name",
  "position": 3,
  "link": {
    "type": "doc",
    "id": "subdirectory-name/index"
  }
}
```

- `label` — displayed in the sidebar.
- `position` — controls sidebar order relative to other items at the same level.
- `link.id` — must point to an `index.md` that exists in the subdirectory. If the subdirectory has no `index.md`, omit the `link` key.

## Cross-linking

Link to related documents wherever readers would benefit from the connection:

- A behaviour doc should link back to its parent component doc.
- An interaction doc should link to each component it covers.
- Infrastructure docs should link to any component that owns or depends on the resource described.

Use relative Docusaurus links: `[Relay Connection](./relay-connection)` or `[Multi-Tenancy](../infrastructure/multi-tenancy)`.

## What NOT to include

- Large implementation code blocks (schemas and type signatures are fine; full function bodies are not).
- Redundant information already captured in `CLAUDE.md` files or `README.md` files in source packages.
- Speculative future ideas that have no current design commitment — use `apps/slaops-docs/notes/` for those.
