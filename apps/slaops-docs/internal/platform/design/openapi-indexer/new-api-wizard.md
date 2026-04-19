---
id: new-api-wizard
title: New API Wizard Design
sidebar_label: New API Wizard
sidebar_position: 7
created_at: 2026-04-19
updated_at: 2026-04-19
implemented_at: ~
author: Derrick
status: draft
tags:
  - openapi-indexer
  - component-design
  - portal
  - oaspec
---

# New API Wizard Design

Design for the `/apis/new` wizard in the portal — covering wizard state management, the two paths (catalogue adopt vs. private registration), and the URL-driven auto-populate behaviour for the private registration path.

Related docs:
- [UI Design](./ui-design) — broader API tab and upload wizard design
- [API & OASpec Data Model](./api-oaspec-data-model) — `api` table, version strategy columns
- [Version Strategies](./version-strategies) — management modes and `url_fetch` strategy

---

## Purpose

The New API Wizard is the entry point for adding an API to a tenant's catalogue. It guides the user through two mutually exclusive paths:

1. **Catalogue adopt** — search the SLAOps-managed global OpenSearch catalogue and adopt a platform-managed API.
2. **Private registration** — register a self-managed API with a name, description, optional external URL, and version strategy.

The wizard is a multi-step flow (`/apis/new`) with a step indicator. State for the entire wizard lives in a Redux slice so that:
- Step transitions do not require prop-drilling.
- The back button can restore prior field values without re-fetching.
- The info auto-populate response is available after the step changes.

---

## Wizard State Slice

All mutable wizard state lives in `src/store/oapiSpecWizardSlice.ts`. Local UI state (hover, focus) stays local to components.

### State shape

```typescript
interface OapiSpecWizardState {
  step: number                          // current step (1 | 2 | 3)
  path: 'catalogue' | 'private' | null  // chosen path
  selectedCatalogueHit: CatalogueHit | null

  // private registration fields
  name: string
  description: string
  externalUrl: string
  versionStrategy: 'manual' | 'url_fetch'
  fetchUrl: string
  fetchCron: string

  // info auto-populate
  infoFetchStatus: 'idle' | 'loading' | 'success' | 'error'
  infoFetchResult: OpenApiInfoResult | null  // populated on success

  // post-creation
  createdApiId: string | null
}

interface OpenApiInfoResult {
  title: string
  description?: string
  version?: string
}
```

### Slice actions

| Action | Payload | Effect |
|---|---|---|
| `setStep` | `number` | Advances or retreats the step |
| `setPath` | `'catalogue' \| 'private'` | Records chosen path |
| `setSelectedCatalogueHit` | `CatalogueHit \| null` | Stores selected catalogue entry |
| `setPrivateField` | `{ field, value }` | Updates any private registration field |
| `setInfoFetchStatus` | `'idle' \| 'loading' \| 'success' \| 'error'` | Tracks info fetch lifecycle |
| `setInfoFetchResult` | `OpenApiInfoResult \| null` | Stores fetched info block |
| `applyInfoResult` | — | Copies `infoFetchResult.title` → `name`, `infoFetchResult.description` → `description` |
| `setCreatedApiId` | `string` | Records the API id after creation |
| `resetWizard` | — | Returns to initial state (used on navigate away) |

All actions are registered via `actionRegistry.registerAll()` with `area: ActionArea.UI` and `group: ActionGroup.Navigation`.

---

## Step Flow

```
Step 1 — Choose path
    ├── Search catalogue → Step 2A (catalogue adopt)
    └── Register my own  → Step 2B (private registration)

Step 2A — Adopt platform API
    └── Click "Adopt API" → navigate /apis/{id}

Step 2B — Private API details
    └── Submit → if url_fetch → navigate /apis/{id}
             → if manual → Step 3 (upload initial spec)

Step 3 — Upload initial spec
    └── Skip / View API → navigate /apis/{id}
```

The `StepIndicator` total is 2 for the catalogue path and 3 for the private path, as today.

---

## Private Registration: External URL Auto-Populate

### Field order

In step 2B (private registration form), the **External URL** field moves to the **top** of the form — above Name and Description. This allows the auto-populate flow to feel natural: the user pastes a URL first and the fields below fill in.

Final form field order:
1. External URL _(with auto-populate trigger below it)_
2. Name *(required)*
3. Description
4. Version strategy
5. Fetch URL + Fetch schedule _(conditional on url_fetch)_

### Auto-populate trigger

When the user types or pastes a value into the External URL field, the component:
1. Validates the value as a URL (using the same Zod `z.string().url()` check as the form schema).
2. If valid and different from the last fetched URL, dispatches `setInfoFetchStatus('loading')` and calls the `useApiInfo` hook.
3. If invalid, dispatches `setInfoFetchStatus('idle')` and clears `infoFetchResult`.

The validation is debounced ~500 ms to avoid firing on every keystroke.

### Backend endpoint

The browser cannot reliably fetch arbitrary OpenAPI docs directly — CORS headers and CSP restrictions vary by host. The portal delegates the fetch to the backend:

```
GET /apis/info?openapi_doc_url={encoded-url}
```

The backend:
1. Downloads the YAML or JSON at `openapi_doc_url`.
2. Parses it and extracts the `info` object.
3. Returns the info block as JSON.

**Response (success — 200):**
```json
{
  "title": "Open-Meteo APIs",
  "description": "Open-Meteo offers free weather forecast APIs ...",
  "version": "1.0"
}
```

All three fields are optional in the OpenAPI spec — the response omits any field that is absent in the source document.

**Error responses:**
| Status | Meaning |
|---|---|
| 400 | `openapi_doc_url` missing or not a valid URL |
| 422 | URL fetched but response is not valid OpenAPI YAML/JSON, or `info` block is missing |
| 502 | Backend could not reach the URL (network error, DNS failure, timeout) |

The `useApiInfo` hook dispatches status actions based on the result:
- On success → `setInfoFetchStatus('success')`, `setInfoFetchResult(data)`
- On 4xx/5xx → `setInfoFetchStatus('error')`, `setInfoFetchResult(null)`

### Auto-populate UX

Immediately below the External URL field, the wizard shows contextual feedback:

| State | UI |
|---|---|
| `idle` | Nothing shown |
| `loading` | Spinner with label "Fetching spec info…" |
| `success` | Green check + "Found: **{title}** v{version}" + **"Use these details"** button |
| `error` | Warning icon + "Couldn't read spec from this URL" (non-blocking; user can still fill fields manually) |

Clicking **"Use these details"** dispatches `applyInfoResult`, which:
- Copies `infoFetchResult.title` into the `name` field (only if `name` is currently empty or matches the previous auto-populated value — does not overwrite user edits).
- Copies `infoFetchResult.description` into the `description` field under the same guard.
- Does not overwrite `version` — `info.version` is available in `infoFetchResult` for the backend to use when creating the API record, but the form has no version field.

The auto-populate guard ensures a user who manually typed a name before triggering the fetch does not have their work overwritten silently.

---

## `useApiInfo` Hook

Lives in `src/hooks/useApiInfo.ts`. Owns the async fetch logic; components do not call `cloudAxios` directly.

```typescript
export function useApiInfo() {
  const dispatch = useAppDispatch()

  const fetchInfo = useCallback(async (url: string) => {
    dispatch(setInfoFetchStatus('loading'))
    dispatch(setInfoFetchResult(null))
    try {
      const { data } = await cloudAxios.get<OpenApiInfoResult>('/apis/info', {
        params: { openapi_doc_url: url },
      })
      dispatch(setInfoFetchResult(data))
      dispatch(setInfoFetchStatus('success'))
    } catch {
      dispatch(setInfoFetchStatus('error'))
    }
  }, [dispatch])

  return { fetchInfo }
}
```

The hook dispatches to the Redux slice — the component reads status and result via selectors:

```typescript
const infoStatus = useAppSelector(selectInfoFetchStatus)
const infoResult = useAppSelector(selectInfoFetchResult)
```

---

## Backend Contract — `GET /apis/info`

This is a new endpoint on `slaops-cloud`. It must be added to the NestJS controller and included in the OpenAPI spec so the portal client can be regenerated.

**Query parameter:** `openapi_doc_url` (string, required, must be a valid absolute URL).

**Behaviour:**
1. Validate `openapi_doc_url` — return 400 if missing or not a URL.
2. `GET openapi_doc_url` with a 10-second timeout and a neutral `User-Agent`.
3. Parse response body as YAML first, then JSON if YAML fails — return 422 if neither parse succeeds.
4. Confirm parsed object has an `info` key — return 422 if absent.
5. Extract `{ title, description, version }` from `info` and return as JSON.

**Security:** The endpoint must not follow redirects to private IP ranges (SSRF mitigation). Validate that the resolved IP is not in RFC1918 / loopback space before making the outbound request.

**Config:** Timeout and redirect policy live in `slaops-config`, not hardcoded.

---

## Component Tree

```
ApisNew (page)
  ├── WizardHeader          — back button, title
  ├── StepIndicator         — reads step + path from Redux
  │
  ├── [step 1] PathSelector
  │     ├── WizardCatalogueSearch    — existing component; onSelect dispatches setSelectedCatalogueHit + setPath + setStep
  │     └── RegisterMyOwnCard        — onClick dispatches setPath('private') + setStep(2)
  │
  ├── [step 2A] CatalogueAdoptStep  — reads selectedCatalogueHit from Redux; calls adoptApi mutation
  │
  ├── [step 2B] PrivateRegistrationForm  — reads/writes private fields via Redux; calls createApi mutation
  │     ├── ExternalUrlField         — debounced validation; calls useApiInfo; shows InfoFetchFeedback
  │     ├── InfoFetchFeedback        — reads infoFetchStatus + infoFetchResult; renders status + "Use these details" button
  │     ├── NameField
  │     ├── DescriptionField
  │     └── VersionStrategySection
  │
  └── [step 3] SpecUploadStep       — reads createdApiId from Redux; wraps existing SpecUploadCard
```

React Hook Form is retained for validation within `PrivateRegistrationForm` — its field values are synced to Redux on change so the slice is always authoritative for back-navigation.

---

## Key Decisions

### Redux slice over local component state

The wizard state was originally `useState` in `ApisNew`. Moving to a slice enables:
- Back-navigation that restores all field values without remounting.
- `useApiInfo` hook dispatching fetch results without prop-threading through form state.
- The `applyInfoResult` action being testable in isolation.

### URL field first, not last

External URL is the highest-signal input — it can drive Name and Description. Placing it first lets the auto-populate flow eliminate manual typing in the common case where the user has a URL.

### Delegate OpenAPI fetch to the backend

Browser-side fetches to arbitrary third-party URLs fail on CORS/CSP for most real-world OpenAPI hosts. A backend proxy sidesteps this reliably. The endpoint is intentionally narrow — it returns only `{ title, description, version }`, not the full spec, so it cannot be used as a generic proxy.

### Non-destructive auto-populate guard

Auto-fill only writes to a field if the field is empty or still contains a previously auto-filled value. User-typed content is never silently overwritten. This avoids a frustrating UX pattern where corrected values get clobbered by a slow network response.
