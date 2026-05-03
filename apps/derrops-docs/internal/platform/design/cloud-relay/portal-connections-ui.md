---
id: portal-connections-ui
title: Portal UI — Connection Management
sidebar_label: Portal — Connections UI
sidebar_position: 8
created_at: 2026-04-01
updated_at: 2026-04-11
implemented_at: ~
author: Derrops Team
status: draft
tags:
  - ui
  - ux
  - portal
  - relay
---

# Portal UI — Connection Management

> **Status**: Draft (Stage 2 redesign)
> **Author**: Derrops Team
> **Updated**: 2026-04-10
> **Related**: [Relay Connection Design](./relay-connection.md), [Local Relay](./local-relay.md), [Aegis Token Broker](./aegis-token-broker-design.md), [Network Topology](./network-topology.md)

## Overview

This document defines the portal UI for managing **Derrops Platform Connections** — the unified entity that represents a connection between the Derrops Platform, a relay deployment, and an optional Aegis authentication broker.

Stage 2 replaces the separate Relay Instances and Aegis Instances pages (Stage 1) with:

- A single **Connections** list page
- A **Create Connection Wizard** with guided, step-by-step setup
- An optional **Aegis** configuration step within the wizard

The UI sits under **Settings → Connections** in the portal navigation.

---

## Navigation Structure

```
Settings
└── Connections
    ├── Connections         (list view — default tab)
    └── Health Dashboard    (tab)
```

The Stage 1 "Relay Instances" and "Aegis Instances" tabs are removed. Aegis instances are managed as part of connection edit, not as a standalone page.

---

## Implementation Status Matrix

Before the wizard steps: a quick reference of which paths are implemented vs not. The wizard surfaces these inline as warnings when the user selects an unimplemented path.

| Feature                                           | Status                                           |
| ------------------------------------------------- | ------------------------------------------------ |
| Direct HTTP — create, edit, delete                | ✅ Implemented                                   |
| Direct HTTP — test connection (HTTP health check) | ✅ Implemented                                   |
| SQS — Derrops-managed queue creation               | ✅ Implemented                                   |
| SQS — IAM user + access key generation            | ❌ Not yet implemented                           |
| SQS — BYO (customer-provided) queue               | ⚠️ Backend supported, no portal flow yet         |
| SQS — test SQS connectivity (canary message)      | ❌ Not yet implemented                           |
| SQS + HTTP hybrid delivery mode                   | ❌ Not yet implemented                           |
| Aegis — link existing Aegis to connection         | ✅ Implemented                                   |
| Aegis — register new Aegis inline in wizard       | ✅ Implemented                                   |
| Connections list page (replaces relay/aegis tabs) | ❌ Not yet implemented (portal has Stage 1 tabs) |
| Wizard progress/step UI                           | ❌ Not yet implemented                           |

---

## 1. Connections List Page

### Layout

Full-width table with a **New Connection** button in the top-right that opens the wizard.

### Table columns

| Column       | Notes                                                   |
| ------------ | ------------------------------------------------------- |
| Name         | Clickable — opens edit drawer                           |
| Connectivity | Badge: `Direct HTTP` · `SQS` · `SQS + HTTP`             |
| Relay type   | Badge: `Self-hosted` · `Managed` · `Local`              |
| Aegis        | Linked Aegis name, or `None`                            |
| Status       | Color-coded badge — see status values below             |
| Last seen    | Relative timestamp (e.g. "3 minutes ago"); `—` if never |
| Actions      | Test · Edit · Delete (icon buttons)                     |

### Status badges

| Status        | Color | Label         |
| ------------- | ----- | ------------- |
| `active`      | Green | Active        |
| `pending`     | Grey  | Pending setup |
| `unreachable` | Red   | Unreachable   |
| `disabled`    | Muted | Disabled      |

### Empty state

> **No connections yet.**
>
> Create a connection to start routing API Tester requests through your infrastructure.
>
> [ New Connection ]

---

## 2. Create Connection Wizard

A multi-step wizard opened from the **New Connection** button. Displayed as a full-screen modal or side panel. A progress indicator shows the current step number and title. The user can navigate back to earlier steps to change selections; navigating back does not lose data entered in later steps.

Steps:

1. **Connectivity** — choose how the platform reaches the relay
2. **HTTP Settings** — relay URL _(shown only if Direct HTTP or SQS + HTTP)_
3. **SQS Settings** — queue ownership and configuration _(shown only if SQS or SQS + HTTP)_
4. **Relay Details** — name and relay type
5. **Aegis** — optional authentication broker
6. **Review & Create** — summary before submission
7. **Success** — connection ID and setup instructions

---

### Step 1 — Connectivity

> _How will the Derrops Platform deliver requests to your relay?_

Three options as selection cards:

#### Direct HTTP

Platform calls the relay's HTTPS endpoint directly and waits for a response. Relay must be reachable from the public internet.

- Delivery mode: `direct`
- Requires: relay URL, relay must accept inbound HTTPS

**✅ Implemented**

---

#### SQS

Platform pushes jobs to an SQS FIFO queue. The relay polls the queue outbound — no inbound connections required. Suitable for relays on private networks, VPCs, or local developer machines.

- Delivery mode: `platform-queue`
- Requires: SQS queue (either Derrops-provisioned or customer-owned)

**✅ Implemented** (queue creation); ❌ IAM credential generation not yet available — inline warning shown if this path is selected.

---

#### SQS + HTTP

Platform uses Direct HTTP when available; falls back to SQS if the relay is unreachable over HTTP. Suitable for relays that may move between network contexts.

- Delivery mode: `hybrid` _(not yet implemented)_

> ⚠️ **Not yet available.** SQS + HTTP is not yet supported. You can complete the wizard, but the connection cannot be activated until this delivery mode is implemented.

Selecting this option shows the HTTP Settings and SQS Settings steps.

---

### Step 2 — HTTP Settings _(shown for Direct HTTP or SQS + HTTP)_

- **Relay URL** (URL input, required) — HTTPS base URL where the relay is reachable. Example: `https://relay.example.com`
- **Test reachability** (inline button) — sends a raw HTTP request to `<url>/health` and shows latency or error. Does not require a registered relay yet.

---

### Step 3 — SQS Settings _(shown for SQS or SQS + HTTP)_

Two sub-options as a segmented control:

#### Option A: Derrops-managed queue

Derrops creates and owns the SQS FIFO queue in its AWS account. IAM credentials are provisioned for the relay to consume messages.

No user input required on this screen. The wizard shows:

- Queue name preview: `derrops--{tenant-id}--relay--middleware--{conn-id}.fifo`
- A callout: _After you create the connection, IAM access credentials will be shown once. Store them before closing._

> ⚠️ **IAM credential generation not yet implemented.** The queue will be created but IAM access keys will not be generated automatically. You will need to configure relay queue access manually until this is available.

#### Option B: Bring your own queue

Customer provides an SQS FIFO queue in their own AWS account. The Derrops platform role is granted `sqs:SendMessage` via a resource policy on the customer's queue.

Fields:

- **Queue URL** (URL input, required) — must be an SQS FIFO queue URL ending in `.fifo`
- **Queue Region** (select, required) — AWS region where the queue resides

After the queue URL is entered, the wizard shows the resource policy statement the user must add to their queue:

```json
{
  "Sid": "AllowDerropsSendMessage",
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::<derrops-account-id>:role/DerropsPlatformRole"
  },
  "Action": "sqs:SendMessage",
  "Resource": "<your-queue-arn>"
}
```

A **Copy policy** button copies the full policy statement with the Derrops account ID pre-filled.

A **Test queue access** button (inline): platform attempts to send a canary message to the queue. Shows `✓ Send successful` or `✗ Send failed — <error>`.

> ⚠️ **BYO queue portal flow not yet implemented.** The backend supports customer-provided queues, but this wizard path has no portal implementation yet.

---

### Step 4 — Relay Details

- **Connection name** (text, required; suggested default: `My Relay`)
- **Relay type** (radio group):
  - `Self-hosted` — customer-deployed relay
  - `Managed` — Derrops-hosted relay
  - `Local` — developer's local machine

> If `Local` is selected and the chosen connectivity in Step 1 is Direct HTTP:
> _Local relays cannot accept inbound connections. Switch to SQS, or go back to Step 1 and choose a different connectivity option._

---

### Step 5 — Aegis _(optional)_

> _Aegis is an optional token broker that ensures only sessions authorised by your identity provider can use this relay._

Two options:

**Skip** (default) — no Aegis for this connection.

**Link Aegis** — choose an existing Aegis instance or register a new one:

- _Select existing_: dropdown listing all registered Aegis instances with status badges. Select one to link.
- _Register new_: inline sub-form expands with: Name, URL, JWKS URL (same fields as old Register Aegis dialog). The one-time registration token is shown in the Step 7 success panel.

When an Aegis is linked, a note appears:

> _After saving, set `AEGIS_JWKS_URL = <aegis-jwks-url>` on your relay and redeploy._

---

### Step 6 — Review & Create

Summary card before submission:

| Setting         | Value                                    |
| --------------- | ---------------------------------------- |
| Connection name | _(entered value)_                        |
| Connectivity    | _(Direct HTTP / SQS / SQS + HTTP)_       |
| Relay URL       | _(entered or `—`)_                       |
| SQS queue       | _(Derrops-managed / `<queue-url>` / `—`)_ |
| Relay type      | _(Self-hosted / Managed / Local)_        |
| Aegis           | _(name or `None`)_                       |

If any selected path is not yet implemented, a banner summarises the limitations:

> ⚠️ Some features you selected are not yet available and will need to be configured manually after creation. See the implementation status table for details.

**Create Connection** button triggers the API calls. **Back** navigates to the previous step. **Cancel** closes the wizard without saving.

---

### Step 7 — Success

Shown after the connection is created. Content varies by connectivity mode.

#### Direct HTTP

```
Connection created.

Connection ID:  abc-123-...  [copy]

Set the following on your relay deployment:
  RELAY_ID               = abc-123-...
  DERROPS_VENDOR_JWKS_URL = https://api.derrops.com/cloud-relay/.well-known/jwks.json

Then click "Test Connection" in the connections list to confirm.
```

#### SQS — Derrops-managed queue

```
Connection created.

Connection ID:   abc-123-...        [copy]
SQS Queue:       derrops--{tid}--relay--middleware--...      [copy]
Region:          ap-southeast-2

IAM Credentials (shown once — save now):

  Access Key ID:      AKIA...        [copy]
  Secret Access Key:  ••••••         [reveal] [copy]

⚠ Save these credentials before closing. They cannot be retrieved again.

[Copy all env vars]

  RELAY_ID               = abc-123-...
  SQS_QUEUE_URL          = https://sqs.ap-southeast-2.amazonaws.com/...
  AWS_ACCESS_KEY_ID      = AKIA...
  AWS_SECRET_ACCESS_KEY  = <secret>
  DERROPS_VENDOR_JWKS_URL = https://api.derrops.com/cloud-relay/.well-known/jwks.json
```

The **Copy all env vars** button copies all lines as shell `export` statements.

A dismiss button is blocked until the user checks _"I have saved the credentials"_ (checkbox). After acknowledging, the dialog becomes dismissible.

#### SQS — BYO queue

```
Connection created.

Connection ID:  abc-123-...  [copy]
Your queue:     <customer-queue-url>

Ensure the resource policy on your queue allows the Derrops
platform role to send messages (see Step 3 for the policy snippet).

Set the following on your relay deployment:
  RELAY_ID               = abc-123-...
  SQS_QUEUE_URL          = <customer-queue-url>
  DERROPS_VENDOR_JWKS_URL = https://api.derrops.com/cloud-relay/.well-known/jwks.json
```

#### Aegis registration token _(prepended if a new Aegis was registered in Step 5)_

Shown above the relay setup section:

```
Aegis registered.

One-time registration token (shown once):

  eyJhb...  [copy]

⚠ Save this token now. It cannot be retrieved after you close this dialog.

Set on your Aegis deployment:
  DERROPS_REGISTRATION_TOKEN = eyJhb...
  DERROPS_PLATFORM_URL       = https://api.derrops.com
```

---

## 3. Edit Connection — Drawer

Opens on row click or Edit icon.

Fields:

- **Name** (editable)
- **Relay URL** (editable; hidden for `Local` relay type)
- **Linked Aegis** (select from registered Aegis instances, or `None`)
- **Connection ID** (read-only + copy button)
- **Relay type** (read-only — cannot be changed after creation)
- **Connectivity mode** (read-only — cannot be changed after creation)
- **SQS Queue URL** (read-only; shown for SQS and SQS + HTTP modes)
- **IAM User** (read-only; shown for Derrops-managed SQS if the IAM user was created; format: `derrops-middleware-{conn-id}`)

Inline warning when Aegis is linked:

> _After linking, set `AEGIS_JWKS_URL = <aegis-jwks-url>` on the relay and redeploy._

---

## 4. Delete Connection — Confirmation Dialog

> **Delete connection "Production Relay"?**
>
> The connection ID will be invalidated. The platform will no longer route jobs through it.
>
> _(If Derrops-managed SQS queue)_ The associated SQS queue and IAM user will also be deleted.
>
> This cannot be undone.
>
> [ Cancel ] [ Delete ]

---

## 5. Test Connection — Inline

Triggered by the **Test** icon in the table row or a button in the edit drawer.

Behaviour varies by connectivity mode:

- **Direct HTTP**: platform mints a relay-scoped JWT, calls `GET <relay-url>/health`. Shows `✓ Reachable — 42 ms` (green) or `✗ Unreachable — connection refused` (red).
- **SQS**: platform sends a canary job to the SQS queue. Shows a spinner while waiting (up to 30s) for the relay to acknowledge, then `✓ Queue acknowledged — 4 s` or `✗ No acknowledgement within 30s`.
- **Local relay note**: _Local relays are not directly reachable. Status reflects the last time the relay polled for a job._

---

## 6. Health Dashboard

A read-only summary page. Auto-refreshes every 60 seconds with a manual refresh button.

### Summary cards (top)

Three metric cards:

- **Active** — count of connections with status `active`
- **Degraded** — count with status `unreachable`
- **Pending setup** — count with status `pending`

### Combined status table

All connections in one table.

| Column       | Notes                                 |
| ------------ | ------------------------------------- |
| Name         | Link to edit drawer                   |
| Connectivity | Badge                                 |
| Aegis        | Name or `None`                        |
| Status       | Color-coded badge                     |
| Last seen    | Relative timestamp                    |
| Test         | Button — triggers health check inline |

---

## 7. Local Relay Onboarding Banner

When a user opens the API Tester and their target URL starts with `localhost` or `127.0.0.1`, and no `local` relay connection is registered or active:

> **Localhost target detected.**
> No local relay is running. Start one to route this request.
>
> `derrops relay start` [copy]
>
> [Set up local relay →] (links to Settings → Connections → New Connection)

Dismissible per session. Does not appear once a `local` relay connection exists.

---

## 8. API Tester — Relay Selector

In the API Tester request panel, a **Relay** dropdown appears above the URL bar when a project has at least one registered connection.

### Dropdown items

```
─ Connections ──────────────────────────
  ● Production Relay      (active)
  ● Staging Relay         (active)
  ○ DR Relay              (unreachable)
─ Local ────────────────────────────────
  ◉ My local relay        (local)   [Local badge]
```

- Active connections are selectable.
- Unreachable connections are shown greyed-out but still selectable (with a warning tooltip).
- Local connections show a distinct **Local** badge.
- If no connections are registered: _No connections — [Set up a connection]_

### Relay selection persistence

The selected connection is persisted per-project (localStorage). On project open, the last-used connection is pre-selected. If that connection has been deleted, fall back to the first active connection.

---

## 9. Component States & Edge Cases

| Scenario                                        | Behaviour                                                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Connection created but health check never run   | Status `Pending setup`; row shows prompt: _Test connection to activate_                                                      |
| SQS connection — no IAM credentials yet         | Status `Pending setup`; edit drawer shows: _IAM credentials have not been generated. Configure relay queue access manually._ |
| Connection linked to a deleted Aegis            | `aegis_id` FK set null by DB cascade; connection shows `Aegis: None` — no error state                                        |
| Local relay — Direct HTTP connectivity selected | Blocked in wizard Step 4 with inline warning before the user can proceed                                                     |
| SQS + HTTP selected                             | Shown with ⚠️ "not yet available" banner on step 1 and in review/create                                                      |
| All connections unreachable                     | Banner in API Tester: _All connections are unreachable. Check your relay deployments._                                       |
| BYO queue — policy not yet applied              | Test queue shows `✗ Access denied — check your queue resource policy`                                                        |

---

## 10. Design Constraints

- **No liveness tracking for local relays.** The portal cannot tell if `derrops relay start` is currently running. Status remains `Pending` until the first SQS poll completes — when `last_seen_at` is set, status becomes `Active`.
- **IAM credentials shown once.** The `secretAccessKey` is returned by the API only at creation time. The portal must surface it prominently and block dismissal until the user acknowledges.
- **Aegis registration token shown once.** Same constraint as above. If created inline in the wizard, shown in the Step 7 success panel before relay env vars.
- **No static secrets on the platform side.** The relay uses its connection ID + IAM credentials (SQS) or just connection ID (HTTP). The platform never stores the IAM secret access key.
- **All pages require tenant-scoped auth.** Every API call passes `x-tenant-id`. Cross-tenant data must never be accessible.

---

## 11. Generated Client API Calls

All portal UI interactions use the generated OpenAPI client at
`apps/derrops-portal/src/client/derrops-cloud/api/`.

Every call requires `x-tenant-id` passed as the first argument.

> **Schema gaps to resolve before implementing the wizard:**
>
> - `GET/POST/DELETE /cloud-relay/connection` exist; `PATCH /cloud-relay/connection/:id` does not yet exist — needed for edit drawer.
> - `POST /cloud-relay/connection/:id/health-check` does not exist — needed for HTTP test button.
> - `POST /cloud-relay/connection/:id/test-queue` does not exist — needed for SQS connectivity test.
> - `CreateCloudRelayConnectionDto` does not yet include `aegisId` — needed for Aegis linkage at creation time.
> - `CloudRelayConnectionResponseDto` (or equivalent) should include `iam_user_arn` and connectivity mode fields.

---

### 11.1 Connections — `CloudRelayConnectionApi`

**Endpoint prefix**: `/cloud-relay/connection`

#### List connections (page load)

```typescript
// GET /cloud-relay/connection
// Header: x-tenant-id: <tenantId>
// Returns: CloudRelayConnection[]
cloudRelayApi.findAllConnections(tenantId)
```

Both the Connections list tab and Health Dashboard tab fire this on mount. Also used to populate the API Tester relay selector.

---

#### Create connection (wizard Step 6)

```typescript
// POST /cloud-relay/connection
// Header: x-tenant-id: <tenantId>
// Body: CreateCloudRelayConnectionDto
// Returns: CreateCloudRelayConnectionResponseDto (includes one-time credentials if applicable)
cloudRelayApi.createConnection(tenantId, {
  name: formValues.name,
  type: formValues.relayType, // 'self-hosted' | 'managed' | 'local-dev'
  delivery_mode: derivedDeliveryMode, // 'direct' | 'platform-queue' | 'hybrid'
  url: formValues.url, // omit for SQS-only connections
  sqs_queue_mode: formValues.queueMode, // 'platform' | 'relay' | null
  relay_sqs_queue_url: formValues.customerQueueUrl, // BYO queue only
  aegisId: formValues.aegisId, // optional UUID
})
```

`CreateCloudRelayConnectionResponseDto` fields used in Step 7:

| Field                    | Usage                                                         |
| ------------------------ | ------------------------------------------------------------- |
| `id`                     | Connection ID — shown as `RELAY_ID`                           |
| `sqs_queue_url`          | SQS queue URL (if provisioned)                                |
| `sqs_region`             | Queue region (if provisioned)                                 |
| `iamAccessKeyId`         | IAM access key ID (one-time; if IAM user was provisioned)     |
| `iamSecretAccessKey`     | IAM secret (one-time; never stored — show and discard)        |
| `aegisRegistrationToken` | Aegis token (one-time; if new Aegis was registered in wizard) |

---

#### Edit connection (drawer save)

```typescript
// PATCH /cloud-relay/connection/:id   ← not yet implemented on backend
// Header: x-tenant-id: <tenantId>
// Body: UpdateCloudRelayConnectionDto
// Returns: CloudRelayConnection
cloudRelayApi.updateConnection(tenantId, connectionId, {
  name: formValues.name,
  url: formValues.url,
  aegisId: formValues.aegisId, // null to unlink
})
```

---

#### Delete connection

```typescript
// DELETE /cloud-relay/connection/:id
// Header: x-tenant-id: <tenantId>
// Returns: void (204)
cloudRelayApi.removeConnection(tenantId, connectionId)
```

Remove from local state on success; no re-fetch needed.

---

#### Test connection — HTTP

```typescript
// POST /cloud-relay/connection/:id/health-check  ← not yet implemented on backend
// Header: x-tenant-id: <tenantId>
// Returns: CloudRelayConnection (updated status + last_seen_at)
cloudRelayApi.healthCheckConnection(tenantId, connectionId)
```

---

#### Test connection — SQS

```typescript
// POST /cloud-relay/connection/:id/test-queue  ← not yet implemented on backend
// Header: x-tenant-id: <tenantId>
// Returns: { acknowledged: boolean, latencyMs?: number, error?: string }
cloudRelayApi.testQueueConnection(tenantId, connectionId)
```

---

### 11.2 Aegis Instances — `AegisInstanceApi`

Aegis instance management remains on the existing `AegisInstanceApi`. The wizard calls these to populate the "Link Aegis" dropdown and to register a new Aegis inline.

See Stage 1 section 6.2 of this document's prior revision for full call signatures — these are unchanged.

Key calls:

- `aegisInstanceApi.aegisInstanceControllerFindAll(tenantId)` — populates the dropdown in Step 5
- `aegisInstanceApi.aegisInstanceControllerCreate(tenantId, dto)` — register new Aegis in Step 5

---

### 11.3 Call Sequencing by Page

#### Connections list tab mount

```
1. cloudRelayApi.findAllConnections(tenantId)      → populate connections table
2. aegisInstanceApi.findAll(tenantId)              → resolve Aegis names in table rows
```

Both in parallel.

#### Health Dashboard tab mount

```
1. cloudRelayApi.findAllConnections(tenantId)      → rows in combined table
2. aegisInstanceApi.findAll(tenantId)              → Aegis status sub-indicators
```

Both in parallel. Auto-refresh repeats every 60 seconds.

#### Wizard — Step 5 (Aegis) mount

```
1. aegisInstanceApi.findAll(tenantId)              → populate "Link existing" dropdown
```

Only if the "Link Aegis" option is chosen.

---

## Related Documents

- [Relay Connection Design](./relay-connection.md) — API endpoints, RDS schema, registration flows, IAM provisioning design, SQS + HTTP hybrid mode
- [Local Relay](./local-relay.md) — Local relay architecture, SQS delivery, CLI commands
- [Aegis Token Broker](./aegis-token-broker-design.md) — Aegis architecture, delegation JWT flow
- [Network Topology](./network-topology.md) — Delivery modes and network requirements
