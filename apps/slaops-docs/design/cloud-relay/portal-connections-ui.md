---
sidebar_position: 8
title: Portal UI — Connection Management
tags: [cloud-relay, portal, ui, ux, design]
---

# Portal UI — Connection Management

> **Status**: Design Brief
> **Author**: SLAOps Team
> **Date**: 2026-04-01
> **Related**: [Relay Connection Design](./relay-connection.md), [Local Relay](./local-relay.md), [Aegis Token Broker](./aegis-token-broker-design.md)

## Overview

This document defines the portal UI for managing relay connections and Aegis instances. The implementation covers the deferred portal work from [relay-connection.md](./relay-connection.md):

- Relay Instances page (self-hosted, managed, and local-dev)
- Aegis Instances page
- Connection health dashboard
- Local relay onboarding

The UI sits under **Settings → Connections** in the portal navigation.

---

## Navigation Structure

```
Settings
└── Connections
    ├── Relay Instances      (tab / sub-nav)
    ├── Aegis Instances      (tab / sub-nav)
    └── Health Dashboard     (tab / sub-nav)
```

---

## 1. Relay Instances Page

### Layout

Full-width table with a **Register Relay** button in the top-right.

### Table columns

| Column | Notes |
|---|---|
| Name | Clickable — opens edit drawer |
| Type | Badge: `Self-hosted` · `Managed` · `Local` |
| URL | Shown for `self-hosted` and `managed`; `—` for `local-dev` (no inbound URL) |
| Status | Color-coded badge — see status values below |
| Last seen | Relative timestamp (e.g. "3 minutes ago"); `—` if never |
| Aegis | Linked Aegis name, or `None` |
| Actions | Test · Edit · Delete (icon buttons) |

### Status badges

| Status | Color | Label |
|---|---|---|
| `active` | Green | Active |
| `pending` | Grey | Pending setup |
| `unreachable` | Red | Unreachable |
| `disabled` | Muted | Disabled |

### Register Relay — modal/drawer

Two paths, selected by a segmented control at the top:

**Self-hosted / Managed**

1. **Name** (text, required)
2. **URL** (URL input, required) — base URL where the relay is reachable
3. **Type** (select: `Self-hosted` / `Managed`) — defaults to `Self-hosted`

On submit, the platform creates the relay record and shows:

```
Relay registered.

Your relay ID:  abc-123-...  [copy]

Set this as RELAY_ID on your relay deployment.
Also set:
  SLAOPS_VENDOR_JWKS_URL = https://api.slaops.com/cloud-relay/.well-known/jwks.json

Then click "Test Connection" to confirm the relay is reachable.
```

**Local (developer machine)**

No URL field — local relays use platform-queue delivery mode and have no inbound URL.

1. **Name** (text, required; default: `<username>'s local relay`)

On submit, the platform creates the `local-dev` relay record and shows:

```
Local relay registered.

Run the following commands on your machine:

  slaops relay init
  slaops relay start

The relay will appear as Active once it connects.
```

Include a copy-all button for the two commands.

> If `slaops-cli` is already installed and the user has run `slaops relay init`, the relay will be auto-discovered. Show a secondary note: *Already initialized? Just run `slaops relay start`.*

### Edit Relay — drawer

Opens on row click or Edit icon.

Fields:
- **Name** (editable)
- **URL** (editable; hidden for `local-dev`)
- **Linked Aegis** (select from registered Aegis instances, or `None`)
- **Relay ID** (read-only + copy button — shown for operator reference)
- **Type** (read-only — cannot be changed after registration)
- **Delivery mode** (read-only — always `platform-queue` for `local-dev`; not shown for other types in stage 1)

Inline warning when Aegis is linked but `AEGIS_JWKS_URL` reminder is needed:
> *After linking, set `AEGIS_JWKS_URL = <aegis-jwks-url>` on the relay and redeploy.*

### Delete Relay — confirmation dialog

> **Delete relay "Production Relay"?**
>
> The relay UUID will be invalidated. The platform will no longer accept or route jobs to it.
> This cannot be undone.
>
> [ Cancel ]  [ Delete ]

### Test Connection — inline

Triggered by the **Test** icon in the table row or a button in the edit drawer.

Shows a loading spinner inline, then one of:

- **Success**: `✓ Reachable — 42 ms` (green)
- **Failure**: `✗ Unreachable — connection refused` (red, with error message)
- **Local relay note**: For `local-dev` relays, show: *Local relays are not directly reachable. Status reflects the last time the relay polled for a job.*

---

## 2. Aegis Instances Page

### Layout

Same table pattern as Relay Instances, with a **Register Aegis** button.

### Table columns

| Column | Notes |
|---|---|
| Name | Clickable — opens edit drawer |
| URL | Base URL of the Aegis service |
| JWKS URL | Displayed truncated; full URL on hover/tooltip |
| Status | Color-coded badge (same values as relay) |
| Last seen | Relative timestamp |
| Linked relays | Count badge — "3 relays"; click opens a popover listing them |
| Actions | Test · Edit · Delete |

### Register Aegis — modal/drawer

1. **Name** (text, required)
2. **URL** (URL input, required) — base URL of the Aegis service
3. **JWKS URL** (URL input, required) — defaults to `<URL>/.well-known/jwks.json` when URL is entered

On submit, shows the one-time registration token:

```
Aegis registered.

One-time registration token (shown once):

  eyJhb...  [copy]

Set this as SLAOPS_REGISTRATION_TOKEN on your Aegis deployment.
Also set SLAOPS_PLATFORM_URL = https://api.slaops.com

Once Aegis calls back, status will change to Active.
```

The token is shown only here and never again. Include a prominent warning:
> *Save this token now. It cannot be retrieved after you close this dialog.*

### Edit Aegis — drawer

Fields:
- **Name** (editable)
- **URL** (editable)
- **JWKS URL** (editable)
- **Instance ID** (read-only + copy)
- **Status** (read-only)
- **Linked relays** (read-only list — shows which relays reference this Aegis; unlink via the relay edit drawer)

Note: re-registration is not possible via edit. If the initial token was lost before the handshake, the operator must delete and re-register.

### Delete Aegis — confirmation dialog

> **Delete Aegis "Staging Aegis"?**
>
> This instance is linked to **2 relays**. Those relays will have their Aegis link removed.
> You will need to redeploy those relays without `AEGIS_JWKS_URL` or link them to a different Aegis instance.
>
> [ Cancel ]  [ Delete ]

Omit the relay count line if no relays are linked.

### Test Connection — inline

Fetches the JWKS URL and validates the key format.

- **Success**: `✓ JWKS valid — 2 keys` (green)
- **Failure**: `✗ Could not fetch JWKS — 404 Not Found` (red)

---

## 3. Health Dashboard

A read-only summary page. Auto-refreshes every 60 seconds (with a manual refresh button).

### Summary cards (top)

Three metric cards:
- **Active** — count of components with status `active`
- **Degraded** — count with status `unreachable`
- **Pending setup** — count with status `pending`

### Combined status table

All registered relays and Aegis instances in one table.

| Column | Notes |
|---|---|
| Component | Icon (relay vs Aegis) + name; link to edit drawer |
| Type | Badge: Relay · Aegis · Local |
| Status | Color-coded badge |
| Last seen | Relative timestamp |
| Test | Button — triggers health check inline |

### Empty state

If no components are registered:

> **No connections registered.**
>
> Register a relay to start routing API Tester requests through your infrastructure.
>
> [ Register Relay ]

---

## 4. Local Relay Onboarding Banner

When a user opens the API Tester and their selected target URL starts with `localhost` or `127.0.0.1`, and no `local-dev` relay is registered or active:

> **Localhost target detected.**
> No local relay is running. Start one to route this request.
>
> `slaops relay start`  [copy]
>
> [Set up local relay →]  (links to Settings → Connections → Register Local)

The banner is dismissible per session. It does not appear once a `local-dev` relay is registered (regardless of liveness — liveness tracking is out of scope for stage 1).

---

## 5. API Tester — Relay Selector

In the API Tester request panel, a **Relay** dropdown appears above the URL bar when a project has at least one registered relay.

### Dropdown items

```
─ Cloud relays ─────────────────────
  ● Production Relay      (active)
  ● Staging Relay         (active)
  ○ DR Relay              (unreachable)
─ Local ────────────────────────────
  ◉ My local relay        (local)   [Local badge]
```

- Active relays are selectable.
- Unreachable relays are shown greyed-out but still selectable (with a warning tooltip).
- Local relays show a distinct **Local** badge.
- If no relays are registered, the dropdown shows: *No relays — [Set up a relay]*

### Relay selection persistence

The selected relay is persisted per-project (localStorage). On project open, the last-used relay is pre-selected. If that relay has been deleted, fall back to the first active relay.

---

## Component States & Edge Cases

| Scenario | Behaviour |
|---|---|
| Relay registered but health check never run | Status shows `Pending setup`; row shows a prompt: *Test connection to activate* |
| Aegis registration token expired before handshake | Status stays `Pending`; edit drawer shows: *Registration handshake not completed. Delete and re-register to get a new token.* |
| All relays unreachable | Banner in API Tester: *All relay connections are unreachable. Check your relay deployments.* |
| `local-dev` relay — edit URL field | URL field is hidden; delivery mode shown as read-only `Platform Queue` |
| Relay linked to a deleted Aegis | `aegis_id` FK is set null by DB cascade; relay shows `Aegis: None` — no error state needed |

---

## Design Constraints

- **No liveness tracking** for local relays in stage 1. The portal cannot tell if `slaops relay start` is currently running. Show status as `Pending` until the first SQS poll completes — when `last_seen_at` is set, show `Active`. Do not attempt to show real-time connected/disconnected state.
- **Registration token shown once.** The plaintext token for Aegis registration is returned by the API only at creation time. The portal must surface it prominently and warn before the dialog is dismissed.
- **No static secrets on relays.** The portal never generates or shows API keys for relays. The relay UUID is the only operator-facing credential.
- **All pages require tenant-scoped auth.** Every API call filters by `tenant_id`. Cross-tenant data must never be accessible.

---

## 6. Generated Client API Calls

All portal UI interactions use the generated OpenAPI client at
`apps/slaops-portal/src/client/slaops-cloud/api/`.

Every call requires `x-tenant-id` passed as the first argument (`xTenantId`).
The portal reads this from the authenticated session context.

> **Schema gap**: `RelayInstance` and `CreateRelayInstanceDto` do not yet carry a `type` field
> (`'managed' | 'self-hosted' | 'local-dev'`). The `url` field on `CreateRelayInstanceDto` is
> currently required, which conflicts with `local-dev` relays that have no inbound URL.
> Both the OpenAPI spec and these DTOs must be updated before the local relay registration path
> can be implemented. Until then, local relay registration can pass an empty string for `url` as
> a temporary workaround — but the spec should be fixed first.

---

### 6.1 Relay Instances — `RelayInstanceApi`

**Client class**: `relay-instance-api.ts` → `RelayInstanceApi`
**Models**: `RelayInstance`, `CreateRelayInstanceDto`, `UpdateRelayInstanceDto`

#### Page load — list all relays

Called when the Relay Instances tab mounts and on each manual refresh.

```typescript
// GET /cloud-relay/relay-instance
// Header: x-tenant-id: <tenantId>
// Returns: RelayInstance[]
relayInstanceApi.relayInstanceControllerFindAll(tenantId)
```

Response shape used by the table:

| Field | Usage |
|---|---|
| `id` | Row key; used in all subsequent calls |
| `name` | Name column |
| `url` | URL column; hidden for `local-dev` (once `type` is added) |
| `status` | Status badge — values: `pending` · `active` · `unreachable` · `disabled` |
| `last_seen_at` | Last seen column (ISO timestamp → relative display) |
| `aegis_id` | Linked Aegis — `null` renders as `None` |
| `created_at` | Available if needed for sorting |

Also called after a health check to refresh the updated `status` and `last_seen_at`.

---

#### Register relay — self-hosted / managed

Called on Register Relay form submit (standard path).

```typescript
// POST /cloud-relay/relay-instance
// Header: x-tenant-id: <tenantId>
// Body: CreateRelayInstanceDto
// Returns: RelayInstance
relayInstanceApi.relayInstanceControllerCreate(tenantId, {
  name: formValues.name,
  url: formValues.url,          // HTTPS URL required
  // type: 'self-hosted'        // pending schema update
})
```

On success: extract `id` from the response to display as the relay UUID the operator sets as `RELAY_ID`.

---

#### Register relay — local-dev

Same endpoint, but `url` will be an empty string (or omitted) pending the schema update that makes
`url` optional for `local-dev`.

```typescript
// POST /cloud-relay/relay-instance
// Header: x-tenant-id: <tenantId>
// Returns: RelayInstance
relayInstanceApi.relayInstanceControllerCreate(tenantId, {
  name: formValues.name,
  url: '',                       // local-dev has no inbound URL
  // type: 'local-dev'           // pending schema update
})
```

On success: surface the `id` to the success panel that shows the `slaops relay init / start` commands.

---

#### Edit relay — open drawer

Called when a row is clicked or the Edit icon is pressed, to populate the drawer with current values.

```typescript
// GET /cloud-relay/relay-instance/:id
// Header: x-tenant-id: <tenantId>
// Returns: RelayInstance
relayInstanceApi.relayInstanceControllerFindOne(tenantId, relayId)
```

Alternatively, the drawer can be populated from the already-fetched list row — a `findOne` is only
needed if the drawer must show data not present in the list response.

---

#### Edit relay — save

Called on drawer save.

```typescript
// PATCH /cloud-relay/relay-instance/:id
// Header: x-tenant-id: <tenantId>
// Body: UpdateRelayInstanceDto
// Returns: RelayInstance
relayInstanceApi.relayInstanceControllerUpdate(tenantId, relayId, {
  name: formValues.name,         // optional
  url: formValues.url,           // optional; omitted for local-dev
  aegisId: formValues.aegisId,   // optional; null to unlink
})
```

`aegisId` must be the UUID of an `AegisInstance` belonging to the same tenant, or `undefined` to
leave the link unchanged. Passing `null` / empty string unlinks Aegis (confirm this with the
backend — `UpdateRelayInstanceDto.aegisId` is typed `string?`, not `string | null`).

---

#### Delete relay

Called on Delete confirmation.

```typescript
// DELETE /cloud-relay/relay-instance/:id
// Header: x-tenant-id: <tenantId>
// Returns: void (204)
relayInstanceApi.relayInstanceControllerRemove(tenantId, relayId)
```

On success: remove the row from local state; no re-fetch needed.

---

#### Test connection

Called by the Test icon in the table row or the Test button in the edit drawer.

```typescript
// POST /cloud-relay/relay-instance/:id/health-check
// Header: x-tenant-id: <tenantId>
// Returns: RelayInstance (updated with new status + last_seen_at)
relayInstanceApi.relayInstanceControllerHealthCheck(tenantId, relayId)
```

The response is the updated `RelayInstance` record. Update the row in local state with the new
`status` and `last_seen_at` from the response.

For `local-dev` relays: this button should be hidden or replaced with an informational note, since
the platform cannot reach a local relay over HTTP. The health check endpoint will return an error
for `local-dev` relays.

---

### 6.2 Aegis Instances — `AegisInstanceApi`

**Client class**: `aegis-instance-api.ts` → `AegisInstanceApi`
**Models**: `AegisInstance`, `AegisCreateResponseDto`, `CreateAegisInstanceDto`, `UpdateAegisInstanceDto`

#### Page load — list all Aegis instances

```typescript
// GET /cloud-relay/aegis-instance
// Header: x-tenant-id: <tenantId>
// Returns: AegisInstance[]
aegisInstanceApi.aegisInstanceControllerFindAll(tenantId)
```

Response shape used by the table:

| Field | Usage |
|---|---|
| `id` | Row key |
| `name` | Name column |
| `url` | URL column |
| `jwks_url` | JWKS URL column (truncated) |
| `status` | Status badge |
| `last_seen_at` | Last seen column |
| `registration_token_hash` | Not shown in UI — `null` means handshake complete; non-null means still pending |

To show linked relay count, cross-reference the relay list: count relays whose `aegis_id` equals
this Aegis `id`. No separate API call is needed if both lists are already loaded.

---

#### Register Aegis

```typescript
// POST /cloud-relay/aegis-instance
// Header: x-tenant-id: <tenantId>
// Body: CreateAegisInstanceDto
// Returns: AegisCreateResponseDto  ← distinct from AegisInstance; includes registrationToken
aegisInstanceApi.aegisInstanceControllerCreate(tenantId, {
  name: formValues.name,
  url: formValues.url,           // HTTPS base URL of Aegis
  jwksUrl: formValues.jwksUrl,   // HTTPS JWKS endpoint
})
```

`AegisCreateResponseDto` is the **only** response that includes `registrationToken` (plaintext).
After this call returns, the token is gone from the backend — it is never returned again.
The portal must display it immediately and block dismissal until the user confirms they have saved it.

`AegisCreateResponseDto` fields:

| Field | Usage |
|---|---|
| `id` | Aegis instance UUID |
| `registrationToken` | **One-time token** — display prominently and copy-enable |
| `status` | Will be `pending` until Aegis completes the handshake |
| `name`, `url`, `jwks_url` | Mirror the submitted values |

---

#### Edit Aegis — open drawer

```typescript
// GET /cloud-relay/aegis-instance/:id
// Header: x-tenant-id: <tenantId>
// Returns: AegisInstance
aegisInstanceApi.aegisInstanceControllerFindOne(tenantId, aegisId)
```

As with relay, can be skipped if drawer is populated from the list cache.

---

#### Edit Aegis — save

```typescript
// PATCH /cloud-relay/aegis-instance/:id
// Header: x-tenant-id: <tenantId>
// Body: UpdateAegisInstanceDto
// Returns: AegisInstance
aegisInstanceApi.aegisInstanceControllerUpdate(tenantId, aegisId, {
  name: formValues.name,         // optional
  url: formValues.url,           // optional
  jwksUrl: formValues.jwksUrl,   // optional
})
```

Only the changed fields need to be sent. All fields in `UpdateAegisInstanceDto` are optional.

---

#### Delete Aegis

```typescript
// DELETE /cloud-relay/aegis-instance/:id
// Header: x-tenant-id: <tenantId>
// Returns: void (204)
aegisInstanceApi.aegisInstanceControllerRemove(tenantId, aegisId)
```

Before calling, check the relay list for any relays with `aegis_id === aegisId` and include the
count in the confirmation dialog. The backend will null out the FK on those relays via ON DELETE SET NULL.

---

#### Test connection (Aegis)

```typescript
// POST /cloud-relay/aegis-instance/:id/health-check
// Header: x-tenant-id: <tenantId>
// Returns: AegisInstance (updated with new status + last_seen_at)
aegisInstanceApi.aegisInstanceControllerHealthCheck(tenantId, aegisId)
```

The backend fetches the JWKS URL and validates key format. Response is the updated `AegisInstance`
record. Use `status` and `last_seen_at` from the response to update the row in local state.

---

### 6.3 Call Sequencing by Page

#### Relay Instances tab mount

```
1. relayInstanceControllerFindAll(tenantId)          → populate relay table
2. aegisInstanceControllerFindAll(tenantId)          → populate Aegis name lookup for relay rows
```

Both calls can be fired in parallel.

#### Aegis Instances tab mount

```
1. aegisInstanceControllerFindAll(tenantId)          → populate Aegis table
2. relayInstanceControllerFindAll(tenantId)          → cross-reference linked relay counts
```

Both calls can be fired in parallel. The relay list is already in cache if the Relay tab was visited first.

#### Health Dashboard tab mount

```
1. relayInstanceControllerFindAll(tenantId)          → relay rows in combined table
2. aegisInstanceControllerFindAll(tenantId)          → Aegis rows in combined table
```

Both in parallel. Auto-refresh repeats both calls every 60 seconds.

#### Register Relay (standard) flow

```
1. relayInstanceControllerCreate(tenantId, dto)      → get id from response
2. (Show relay ID to operator)
3. (Operator deploys relay with RELAY_ID env var)
4. relayInstanceControllerHealthCheck(tenantId, id)  → confirm active
```

Step 4 is operator-triggered (Test button), not automatic.

#### Register Aegis flow

```
1. aegisInstanceControllerCreate(tenantId, dto)      → get registrationToken from AegisCreateResponseDto
2. (Show token to operator — one time only)
3. (Operator sets SLAOPS_REGISTRATION_TOKEN on Aegis and starts it)
4. (Aegis calls POST /cloud-relay/aegis/register — backend-to-backend, not portal)
5. aegisInstanceControllerFindOne(tenantId, id)      → poll until status === 'active'
```

Step 5 is either manual (operator refreshes) or a lightweight poll on the registration success dialog
(e.g. every 5 seconds while the dialog is open, stop when `status` becomes `active`).

---

### 6.4 Local state management notes

- Keep relay and Aegis lists in a shared context/store so the Relay Instances tab can resolve
  Aegis names and the Aegis Instances tab can compute linked relay counts without redundant fetches.
- After any mutation (create, update, delete, health check), update the cached item rather than
  re-fetching the full list — all mutation responses return the updated record.
- `DELETE` returns `void` (204) — remove the item from local state by its `id`.

---

## Related Documents

- [Relay Connection Design](./relay-connection.md) — API endpoints, RDS schema, registration flows
- [Local Relay](./local-relay.md) — Local relay architecture, SQS delivery, CLI commands
- [Aegis Token Broker](./aegis-token-broker-design.md) — Aegis architecture, delegation JWT flow
- [Network Topology](./network-topology.md) — Delivery modes and network requirements
