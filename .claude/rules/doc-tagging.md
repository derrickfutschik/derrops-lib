# Documentation Tagging Rules

Apply these rules whenever creating or editing any `.md` file under `apps/slaops-docs/`.

## Tag format

- All tags **must be lowercase with hyphens** as word separators: `cloud-relay`, not `CloudRelay` or `cloud_relay`.
- Tags go in the `tags:` YAML array in frontmatter — never in the body text.

## Ideas (`internal/platform/drafts/`)

Every idea doc must carry:

1. The `idea` tag — this signals raw/unstructured content
2. At least one topic hint (free-form, but prefer tags from `design/tags.yml` where applicable)

Do **not** add a `draft` tag to idea docs — the file's location in `drafts/` already communicates its WIP status. `draft` is reserved for the `status` field of design docs.

## Design docs (`internal/platform/design/`)

Every design document must carry:

1. At least one **topic tag** from `apps/slaops-docs/internal/platform/design/tags.yml`
2. Exactly one **domain tag** — the primary domain the document belongs to:
   - `platform` — core shared infra (VPC, DB, OpenSearch, API Gateway)
   - `auth` — identity, Cognito, IAM, token issuance
   - `oaspec` — OpenAPI spec management, indexing, storage, search
   - `relay` — Cloud Relay, local relay, Aegis Token Broker
   - `logging` — log ingestion, enrichment, storage
   - `portal` — web portal, dashboards, SLA metrics

If a document genuinely spans two domains, list both — avoid a third. Add the `implemented` tag once the feature is shipped.

The `status` frontmatter field (not a tag) tracks design maturity:

```
draft → proposed → accepted → implemented → superseded
```

## Public/quickstart docs (`public/docs/`)

Every public doc must carry:

1. A feature-area tag relevant to the guide content
2. An app tag: `portal`, `relay`, `aegis`, or `client` depending on the feature being documented

## Separation from AWS CDK tags

Doc tags and AWS resource tags (`slaops:domain`, `slaops:service`, etc.) are **different systems**. The domain names overlap by convention, but doc tags are plain lowercase strings in YAML frontmatter — never use the `slaops:key` colon-separated format in a doc file.

See:

- `apps/slaops-docs/internal/platform/design/tags.yml` — authoritative doc tag list
- `apps/slaops-docs/internal/platform/design/infrastructure/tagging-conventions.md` — AWS resource tags (separate system)
