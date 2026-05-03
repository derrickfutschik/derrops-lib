---
id: api-tester-connection-switcher
title: API Tester — Connection Switcher
sidebar_label: API Tester — Connection Switcher
sidebar_position: 10
created_at: 2026-04-11
updated_at: 2026-04-11
implemented_at: ~
author: dfutschik
status: draft
tags:
  - component-design
  - cloud-relay
  - portal
  - relay
---

# API Tester — Connection Switcher

> **Status**: Draft
> **Author**: dfutschik
> **Related**: [API Tester — Relay Execution](./api-tester-relay-execution), [Portal Connections UI](./portal-connections-ui), [Relay Connection Design](./relay-connection)

## Overview

The connection switcher is the UI control in the API Tester that lets a user choose _how_ the current request is dispatched: through a registered relay connection, or directly from the browser. It is the entry point to the two-path send architecture described in [API Tester — Relay Execution](./api-tester-relay-execution).

This document covers:

- The `RelaySelector` component and `useRelaySelector` hook (current implementation)
- The "Browser (direct)" option — explicit no-connection mode
- Selection state machine: auto-select, persistence, deleted-connection recovery
- Switching behaviour while a request is in-flight
- Planned improvements not yet implemented

---

## Components Involved

| Component                         | Role                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `RelaySelector.tsx`               | Dropdown UI — renders connection list with "Browser (direct)" as the first option    |
| `useRelaySelector.ts`             | Hook — owns connection ID state, localStorage persistence, auto-selection logic      |
| `useConnections.ts` (React Query) | Fetches the connections list from `GET /cloud-relay/connection`                      |
| `useSendRequest.ts`               | Consumes `relaySelector.connectionId` to branch between relay and browser send paths |
| `useRelayJob.ts`                  | Manages relay job submission and long-poll loop (relay path only)                    |
| `apiRequestSlice.ts`              | Redux slice holding `isSendingRequest` and `requestResponse`                         |

---

## Current Implementation

### RelaySelector component

`RelaySelector` is a shadcn/ui `Select` dropdown rendered above the URL bar. It accepts four props:

```typescript
interface RelaySelectorProps {
  connectionId: string | null // null = browser (direct) mode
  connections: CloudRelayConnection[]
  isLoading: boolean
  onSelect: (id: string | null) => void
}
```

The sentinel value `__browser__` is used internally to represent the "no connection" state, since shadcn `Select` requires a string value. Selecting `__browser__` calls `onSelect(null)`.

A "Manage connections →" item at the bottom navigates to `/connections`.

### Dropdown layout

```
Browser (direct)               ← always first; null connection
─ Connections ──────────────────
  Production Relay    [SQS]    ← remote connections (type != 'local-dev')
  Staging Relay       [HTTP]
─ Local ─────────────────────────
  My local relay      [Local]  ← type === 'local-dev'
─────────────────────────────────
Manage connections →
```

The delivery-mode badge (`HTTP` or `SQS`) is derived from `connection.delivery_mode`:

- `direct` or `relay-queue` → `HTTP`
- `platform-queue` → `SQS`

### useRelaySelector hook

The hook is responsible for selection state and persistence. It is not in Redux — connection selection is session-local to the API Tester page and does not need to be shared across components.

```typescript
interface RelaySelection {
  connectionId: string | null // null = browser mode
  connection: CloudRelayConnection | null
  connections: CloudRelayConnection[]
  isLoading: boolean
  setConnectionId: (id: string | null) => void
  deletedWarning: boolean
  clearDeletedWarning: () => void
}
```

**Auto-selection on load:** if no stored preference exists and at least one non-local connection is registered, the hook auto-selects the first non-local connection. This means new users with connections get relay mode by default — they do not have to manually pick one.

**localStorage key:** `derrops_apitester_relay` (a JSON-serialised `string | null`).

---

## Selection State Machine

```
[No stored preference]
  └─ connections available?
       yes → auto-select first non-local connection → persist
       no  → connectionId = null (browser mode)

[Stored preference]
  └─ validate against current connections list
       found       → use it
       not found   → clear storage, connectionId = null (browser mode), set deletedWarning = true
```

### State transitions

| Trigger                             | From | To                                | Side effect                            |
| ----------------------------------- | ---- | --------------------------------- | -------------------------------------- |
| Page load — no preference           | —    | null (browser) or first non-local | Persist if auto-selected               |
| Page load — valid preference        | —    | stored connectionId               | —                                      |
| Page load — stale preference        | —    | null (browser)                    | Clear localStorage; show deleted toast |
| User selects a connection           | any  | selected connectionId             | Persist to localStorage                |
| User selects "Browser (direct)"     | any  | null                              | Persist null to localStorage           |
| User selects "Manage connections →" | any  | unchanged                         | Navigate to `/connections`             |

### Deleted-connection recovery

When a stored connection ID no longer exists in the connections list:

1. `useRelaySelector` sets `deletedWarning = true` and clears localStorage.
2. `ApiTester` watches `relaySelector.deletedWarning` in a `useEffect` and fires a toast:
   _"Your previously selected relay connection was deleted. Switched to Browser (direct)."_
3. `relaySelector.clearDeletedWarning()` is called after the toast so it fires only once.

---

## Browser (Direct) Mode

Selecting "Browser (direct)" sets `connectionId = null`. This is the explicit opt-out from relay routing — requests are made directly from the user's browser using the native `fetch()` API.

**Use cases:**

- APIs reachable from the public internet with permissive CORS headers.
- Development environments accessible from the user's machine.
- Testing without relay infrastructure configured.

**Constraints when using browser mode:**

- CORS restrictions enforced by the browser apply in full.
- Requests carry the user's browser IP, not a fixed egress IP.
- Private APIs behind a firewall or VPN are unreachable unless the user's machine is on the same network.
- Timing reflects browser-to-API round-trip; no relay-measured timing is available.

The response panel does not show "Via" or "Mode" metadata for browser-direct results. Relay metadata fields are only present when `relayConnectionName` is set in `RequestResponse`.

---

## Send Path Branching

`useSendRequest` reads `relaySelector.connectionId` to branch on every send:

```
connectionId === null
  → browser path: native fetch(), dispatch setRequestResponse directly
  → onRequestSent callback fires (URL history update)
  → on response.ok: save to localStorage

connectionId !== null && connection !== null
  → relay path: relayJob.submit({ connectionId, ... })
  → return immediately — result arrives via useEffect watching relayJob.status
  → useEffect dispatches setRequestResponse on completion/failure
```

The two paths share the same Redux state (`isSendingRequest`, `requestResponse`) so the response panel and loading indicator behave identically regardless of how the request was dispatched.

---

## Switching While In-Flight

### Idle (no request in-flight)

- `setConnectionId(newId)` updates state and persists to localStorage.
- Request state (URL, method, headers, body) is preserved.
- The response panel retains its previous result — it is not cleared on switch.
- The new selection takes effect on the next Send.

### While browser request is executing

- The browser `fetch()` is already in-flight; it cannot be cancelled.
- `setConnectionId` updates the selector state immediately.
- The in-flight fetch completes and dispatches `setRequestResponse` normally.
- The next Send uses the newly selected connection.
- The response panel shows no "Via" metadata for the in-flight result (it was a browser request).

### While relay job is in-flight

- `relayJob.submit()` has already been called; the job is queued on the platform.
- `setConnectionId` updates the dropdown immediately and persists.
- **The relay job is not cancelled.** The job was submitted to the old connection's relay — cancelling the client-side poll does not stop relay execution.
- The long-poll continues. When the result arrives, `useEffect` dispatches `setRequestResponse`. The response banner shows _"Via [old connection name]"_ — the connection that actually ran it.
- The next Send uses the newly selected connection.

This behaviour is intentional: the user is never left with a result that silently came from a connection different from the one currently displayed. The banner makes provenance explicit.

---

## Planned Improvements

The following are not yet implemented. They represent the intended direction for the switcher UI once the core send path is stable.

### Connection status indicators

Connection rows in the dropdown should show a status dot (`active` / `unreachable` / `pending`) so the user can tell at a glance whether a connection is healthy before selecting it.

| Status        | Visual                  | Behaviour                                                                      |
| ------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `active`      | Green dot               | Selectable normally                                                            |
| `unreachable` | Red dot, greyed text    | Selectable; warning tooltip: _"This connection was last seen as unreachable."_ |
| `pending`     | Clock icon, greyed text | Selectable; warning tooltip: _"This connection has not completed setup."_      |

### Guard rails on Send

When the selected connection is `unreachable`: show an inline banner above the Send button:
_"This connection appears unreachable. [Send anyway] [Cancel]"_

When the selected connection is `pending`: block Send with a tooltip:
_"Complete connection setup before sending."_

When the connection is deleted between page load and Send: the `POST /cloud-relay/job` returns 404; portal shows:
_"Connection not found — it may have been deleted. [Select a connection]"_

### Localhost detection banner

When the request URL targets `localhost` or `127.0.0.1` and no local relay connection is active:

> **Localhost target detected.**
> No local relay is running. Start one to route this request.
>
> `derrops relay start`
>
> [Set up local relay →]

Dismissible per session.

### Relay-measured timing in the response panel

When a relay result is displayed, the status ribbon (HTTP status + portal-measured duration) should gain:

| Field        | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| Via          | Connection name (e.g. _Production Relay_)                            |
| Mode         | `SQS` or `HTTP`                                                      |
| Relay timing | Time measured by the relay itself, shown alongside portal round-trip |

`relayConnectionName` and `relayDeliveryMode` are already stored in `RequestResponse` in `apiRequestSlice`; the display fields just need to be wired into the response ribbon UI.

---

## Key Decisions

**`connectionId = null` represents browser mode, not an unset state.** A null connection ID has explicit meaning throughout `useRelaySelector`, `useSendRequest`, and `RelaySelector`. This avoids a three-way distinction between "not loaded yet", "no preference", and "deliberately browser mode" — instead, null always means "send from the browser", and loading state is tracked separately via `isLoading`.

**Auto-select first non-local connection on first load.** Users with relay infrastructure configured get relay mode by default. This is the primary use case for the API Tester — users who want browser mode can always select it explicitly.

**No Redux for connection selection state.** The selected connection ID is UI state local to the API Tester page. It does not need to be shared across pages, and `useRelaySelector` already handles persistence via localStorage. Adding it to Redux would add complexity without benefit.

**In-flight jobs are not cancelled on connection switch.** Cancelling the client-side long-poll does not stop relay execution — the job is already enqueued. Letting it complete and annotating the result with the originating connection name is simpler and more honest than a cancel/re-submit flow.

---

## Failure Modes

| Failure                                     | Detection                                                        | Handling                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Stored connection deleted between sessions  | `connectionId` not in connections list on load                   | Clear localStorage; `connectionId = null`; show one-time toast           |
| Connections API unreachable on load         | React Query error state; `isLoading = false`, `connections = []` | Selector shows only "Browser (direct)" and "Manage connections →"        |
| Connection deleted while API Tester is open | Next Send → `POST /cloud-relay/job` returns 404                  | _(Planned)_ Show inline error with link to select a different connection |
| Connection becomes unreachable mid-session  | Status badge stales in dropdown                                  | _(Planned)_ Status indicators + Send guard rail                          |

---

## Related Documents

- [API Tester — Relay Execution](./api-tester-relay-execution) — job submission protocol, long-poll loop, SQS message format
- [Portal Connections UI](./portal-connections-ui) — Connections management page, wizard, health dashboard
- [Relay Connection Design](./relay-connection) — connection trust model, delivery modes, SQS provisioning
- [Network Topology](./network-topology) — delivery mode selection rationale
- [Local Relay](./local-relay) — local relay setup for `localhost` targets
