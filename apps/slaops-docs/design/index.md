---
id: index
title: Design
sidebar_label: Overview
sidebar_position: 1
---

# Design

Internal architecture and component design documentation for the SLAOps platform.

## Sections

### [Cloud Relay](./cloud-relay)

The customer-deployed HTTP proxy for API testing. Covers component design, network topology, connection trust model, Aegis Token Broker (credential injection), local development relay, and security/auth methods.

### [OpenAPI Indexer](./openapi-indexer/openapi-directory-indexer)

Event-driven S3-to-OpenSearch indexing pipeline for OpenAPI specifications. Covers architecture, indexing flow, search query design, and rollout plan.

### [Component Proposal Process](./process/component-proposal-standard)

Standards and templates for proposing new platform components — how to write a proposal, the lifecycle from draft to implemented, and a worked example.

## Tags

Documents are tagged for cross-cutting navigation. Browse by tag at [/design/tags](/design/tags).

| Tag | Description |
|---|---|
| `cloud-relay` | Cloud Relay component docs |
| `aegis` | Aegis Token Broker docs |
| `openapi-indexer` | OpenAPI indexing pipeline docs |
| `authentication` | Auth protocols — JWT, mTLS, HMAC, IAM |
| `security` | Security model and trust boundaries |
| `networking` | Network topology and delivery modes |
| `data-pipeline` | Data ingestion, indexing, and search |
| `cli` | slaops-cli tooling |
| `component-design` | Component proposals and design specs |
| `architecture` | System architecture and ADRs |
| `implemented` | Designs for features that have been built |
| `process` | Team process and standards |
