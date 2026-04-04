---
id: index
title: Quickstart Guides
sidebar_label: Overview
sidebar_position: 1
description: Step-by-step guides to get SLAOps running — from account creation to your first monitored request.
tags:
  - quickstart
  - getting-started
---

# Quickstart Guides

These guides take you from a fresh account to a fully running SLAOps setup as quickly as possible. Each guide is self-contained — follow them in order for a complete setup, or jump to the one you need.

---

## Guides in this section

| Guide | What you will have at the end |
|---|---|
| [1. Sign up and log in](./portal-login) | An SLAOps account and access to the Portal |
| [2. Local relay](./local-relay) | A relay running on your machine for testing `localhost` services |
| [3. Cloud relay](./cloud-relay) | A relay deployed in your cloud environment or SLAOps-managed |
| [4. Aegis](./aegis) | Customer-controlled credential injection and request authorisation |

---

## Which guides do I need?

**I'm a developer testing a local service** (e.g. `localhost:3001`)

Follow guides 1 and 2. You do not need a cloud relay or Aegis for local development.

**I'm setting up a staging or production environment**

Follow guides 1, 3, and 4. A cloud relay plus Aegis is the recommended production configuration.

**I want to understand the full architecture first**

See [Architecture Planes](/docs/archiecture-planes) for a conceptual overview before running anything.

---

## Component overview

```
┌──────────────────────────────────────────────────────────────┐
│  SLAOps Portal  (SLAOps cloud)                               │
│  API Tester · Monitoring · Cost Analysis · Alerts            │
└────────────────────────┬─────────────────────────────────────┘
                         │ job dispatch
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Relay  (your infrastructure or local machine)               │
│  Executes HTTP requests · Returns results                     │
└────────────────────────┬─────────────────────────────────────┘
                         │ credential request (optional)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Aegis  (your infrastructure — optional)                     │
│  Injects secrets · Enforces request policy · Audit log       │
└──────────────────────────────────────────────────────────────┘
```

Credentials never leave your environment. The Portal schedules work; the relay executes it; Aegis controls what the relay is allowed to do.
