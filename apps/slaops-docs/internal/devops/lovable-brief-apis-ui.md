---
id: lovable-brief-apis-ui
title: Lovable Brief — APIs UI
sidebar_label: APIs UI Brief
sidebar_position: 90
---

# Lovable Brief — APIs UI

Complete specification for building the **APIs** section of the SLAOps portal. The generated API client is already in place at `src/client/slaops-cloud/` — do not regenerate or modify it.

---

## 1. Tech Stack (existing — do not change)

| Concern | Library |
|---|---|
| UI primitives | shadcn/ui (Radix) — `src/components/ui/` |
| Styling | Tailwind CSS v3 · `cn()` from `@/lib/utils` |
| State | Redux Toolkit — `src/store/` |
| Async data | `@tanstack/react-query` (`useQuery` / `useMutation`) |
| Forms | React Hook Form + Zod |
| Routing | React Router v6 |
| Auth | AWS Amplify / Cognito — injected automatically by `cloudAxios` |
| API calls | Generated client + `cloudAxios` from `src/lib/cloud-api.ts` |

**All backend calls must go through `cloudAxios`.** It injects the Cognito `Authorization: Bearer <token>` header on every request — do not add auth manually. Use the pattern established in `src/hooks/useConnectionsApi.ts`.

---

## 2. Generated Client — Exact Classes and Methods

The generated client lives in `src/client/slaops-cloud/`. Import from `@/client/slaops-cloud`.

### `APIApi` — `src/client/slaops-cloud/api/apiapi.ts`

```typescript
import { APIApi } from '@/client/slaops-cloud'
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'

const api = new APIApi(cloudApiConfig, undefined, cloudAxios)
```

| Method | Signature | Returns |
|---|---|---|
| `apiControllerFindAll` | `()` | `ApiEntity[]` |
| `apiControllerFindOne` | `(id: string)` | `ApiEntity` |
| `apiControllerCreate` | `(createApiDto: CreateApiDto)` | `ApiEntity` |
| `apiControllerUpdate` | `(id: string, updateApiDto: UpdateApiDto)` | `ApiEntity` |
| `apiControllerRemove` | `(id: string)` | `void` |
| `apiControllerAdopt` | `(adoptApiDto: AdoptApiDto)` | `ApiEntity` |

### `OpenAPIIndexerApi` — `src/client/slaops-cloud/api/open-apiindexer-api.ts`

```typescript
import { OpenAPIIndexerApi } from '@/client/slaops-cloud'

const indexerApi = new OpenAPIIndexerApi(cloudApiConfig, undefined, cloudAxios)
```

| Method | Signature | Description |
|---|---|---|
| `openApiIndexerControllerGetUploadUrl` | `(body: { apiId: string; key: string })` | Get pre-signed S3 PUT URL |
| `openApiIndexerControllerIndexFromS3` | `(body: { apiId: string; bucket: string; key: string })` | Trigger indexing pipeline |
| `openApiIndexerControllerSearchCatalogue` | `(offset?: number, limit?: number, q?: string)` | Search platform catalogue |

> These three methods return `void` in the generated types — use `data` from the Axios response and cast to the shapes described in Section 4 below.

---

## 3. Generated Models

Import all types from `@/client/slaops-cloud`. Never define local interfaces that mirror backend shapes.

```typescript
import type {
  ApiEntity,
  OaSpecRef,
  VersionFetchState,
  CreateApiDto,
  UpdateApiDto,
  AdoptApiDto,
} from '@/client/slaops-cloud'

import {
  ApiEntityManagementModeEnum,
  VersionFetchStateStrategyEnum,
  VersionFetchStateLastStatusEnum,
} from '@/client/slaops-cloud'
```

### `ApiEntity`

```typescript
interface ApiEntity {
  id: string
  tenantId: string
  name: string
  description?: string | null
  externalUrl?: string | null
  specType: string                              // "openapi"
  managementMode: 'private' | 'platform'        // ApiEntityManagementModeEnum
  oaSpec: OaSpecRef
  fetch: VersionFetchState
  createdAt: string
  updatedAt: string
}
```

### `OaSpecRef`

```typescript
interface OaSpecRef {
  bucket?: string
  key?: string
  latestVersion?: string       // e.g. "3.1.0" — null until first index run
  globalOpensearchId?: string  // set for platform-managed APIs
  operationCount?: number
  serverCount?: number
  parameterCount?: number
  modelCount?: number
  lastIndexedAt?: string       // ISO timestamp
}
```

### `VersionFetchState`

```typescript
interface VersionFetchState {
  strategy?: 'manual' | 'url_fetch'            // VersionFetchStateStrategyEnum
  url?: string
  cron?: string                                // e.g. "0 2 * * *"
  lastAt?: string                              // ISO timestamp
  lastStatus?: 'ok' | 'error' | 'no_change'   // VersionFetchStateLastStatusEnum
  lastError?: string
  consecutiveFailures?: number
}
```

### `CreateApiDto`

```typescript
interface CreateApiDto {
  name: string
  description?: string
  externalUrl?: string
  versionStrategy?: 'manual' | 'url_fetch'
  fetchCron?: string
  fetchUrl?: string
}
```

### `UpdateApiDto` — all fields optional, same shape as `CreateApiDto`

### `AdoptApiDto`

```typescript
interface AdoptApiDto {
  globalOpensearchId: string   // ID of the platform catalogue spec doc
}
```

---

## 4. Non-typed Response Shapes

These two endpoints return typed data at runtime but the generated client types them as `void`. Cast the `data` property:

### `openApiIndexerControllerGetUploadUrl` response

```typescript
interface PresignedUrlResult {
  url: string     // pre-signed S3 PUT URL — PUT the file directly to this URL (no auth header)
  key: string     // S3 object key to use in the index call
  bucket: string  // S3 bucket name to use in the index call
  expiresIn: number
}
```

### `openApiIndexerControllerIndexFromS3` response

```typescript
interface IndexingResponse {
  success: boolean
  apiId: string
  version: string
  specOpensearchId: string
  durationMs: number
  counts: {
    operations: number
    servers: number
    parameters: number
    models: number
  }
  truncated: {
    operations: boolean
    models: boolean
  }
  versionsPruned: number
  errors: Array<{ step: string; message: string }>
}
```

### `openApiIndexerControllerSearchCatalogue` response

```typescript
interface CatalogueResponse {
  total: number
  hits: Array<{
    id: string
    title: string
    description?: string
    version?: string
    operationCount?: number
    serverCount?: number
    tagsText?: string
  }>
}
```

---

## 5. Hook Pattern

Follow the exact pattern in `src/hooks/useConnectionsApi.ts`. Create two new hook files:

### `src/hooks/useApisApi.ts`

```typescript
import { APIApi, type ApiEntity, type CreateApiDto, type UpdateApiDto, type AdoptApiDto } from '@/client/slaops-cloud'
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

function useApisClient() {
  return useMemo(() => new APIApi(cloudApiConfig, undefined, cloudAxios), [])
}

export function useApis() {
  const client = useApisClient()
  return useQuery<ApiEntity[]>({
    queryKey: ['apis'],
    queryFn: async () => {
      const { data } = await client.apiControllerFindAll()
      return data
    },
  })
}

export function useApi(id: string) {
  const client = useApisClient()
  return useQuery<ApiEntity>({
    queryKey: ['apis', id],
    queryFn: async () => {
      const { data } = await client.apiControllerFindOne(id)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateApi() {
  const client = useApisClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateApiDto) => client.apiControllerCreate(dto).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apis'] }),
  })
}

export function useUpdateApi() {
  const client = useApisClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateApiDto }) =>
      client.apiControllerUpdate(id, dto).then(r => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['apis'] })
      queryClient.invalidateQueries({ queryKey: ['apis', id] })
    },
  })
}

export function useDeleteApi() {
  const client = useApisClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client.apiControllerRemove(id).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apis'] }),
  })
}

export function useAdoptApi() {
  const client = useApisClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: AdoptApiDto) => client.apiControllerAdopt(dto).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apis'] }),
  })
}
```

### `src/hooks/useIndexerApi.ts`

```typescript
import { OpenAPIIndexerApi } from '@/client/slaops-cloud'
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { PresignedUrlResult, IndexingResponse, CatalogueResponse } from '@/types/indexer'
// Define those three interfaces in src/types/indexer.ts — they are internal UI types,
// not mirrors of backend models, so a local type file is appropriate here.

function useIndexerClient() {
  return useMemo(() => new OpenAPIIndexerApi(cloudApiConfig, undefined, cloudAxios), [])
}

export function useUploadUrl() {
  const client = useIndexerClient()
  return useMutation({
    mutationFn: (params: { apiId: string; key: string }) =>
      client.openApiIndexerControllerGetUploadUrl(params).then(r => r.data as unknown as PresignedUrlResult),
  })
}

export function useIndexSpec() {
  const client = useIndexerClient()
  return useMutation({
    mutationFn: (params: { apiId: string; bucket: string; key: string }) =>
      client.openApiIndexerControllerIndexFromS3(params).then(r => r.data as unknown as IndexingResponse),
  })
}

export function useCatalogue(q: string, limit = 10) {
  const client = useIndexerClient()
  return useQuery<CatalogueResponse>({
    queryKey: ['catalogue', q, limit],
    queryFn: async () => {
      const { data } = await client.openApiIndexerControllerSearchCatalogue(0, limit, q)
      return data as unknown as CatalogueResponse
    },
  })
}
```

> Create `src/types/indexer.ts` for `PresignedUrlResult`, `IndexingResponse`, and `CatalogueResponse` — these are purely internal response shapes for endpoints that lack generated types.

---

## 6. New Routes

Add to `App.tsx` inside the existing `<ProtectedRoute>` pattern:

```
/apis              → src/pages/Apis.tsx
/apis/new          → src/pages/ApisNew.tsx
/apis/:id          → src/pages/ApiDetail.tsx
```

---

## 7. Navigation

Add an **APIs** link to the sidebar or top navigation (wherever `src/components/NavLink.tsx` or the dashboard layout renders nav items). Points to `/apis`.

---

## 8. Redux State

Add `ActionGroup.Apis` to the `ActionGroup` enum in `src/store/actionMeta.ts`.

Create `src/store/apisSlice.ts`:

```typescript
interface ApisState {
  wizardOpen: boolean
  wizardStep: number                               // 1 | 2 | 3
  wizardPath: 'catalogue' | 'private' | null
  detailTab: 'overview' | 'versions' | 'operations' | 'servers' | 'parameters' | 'models'
  operationsQuery: string
  paramsQuery: string
  modelsQuery: string
}
```

Register every action via `actionRegistry.registerAll()` following the existing pattern. Export typed selectors alongside the actions.

---

## 9. Screen Specifications

---

### 9.1 APIs List (`/apis`) — `src/pages/Apis.tsx`

Call `useApis()` on mount. Style matches the existing Connections page.

**Header:** "APIs" title, "Manage your OpenAPI specifications" subtitle, "New API" primary button → navigate to `/apis/new`.

**Table** (shadcn `<Table>`):

| Column | Source | Notes |
|---|---|---|
| Name | `api.name` | Clickable → `/apis/:id` |
| Mode | `api.managementMode` | Badge: `Platform` = blue, `Private` = gray. Use `ApiEntityManagementModeEnum` |
| Version | `api.oaSpec.latestVersion` | `—` if null |
| Operations | `api.oaSpec.operationCount` | `—` if null |
| Servers | `api.oaSpec.serverCount` | `—` if null |
| Strategy | `api.fetch.strategy` | Badge: `manual` = gray, `url_fetch` = green. Use `VersionFetchStateStrategyEnum`. Hidden when `managementMode === 'platform'` |
| Last indexed | `api.oaSpec.lastIndexedAt` | Relative (e.g. "3 days ago"). "Never" if null |
| Actions | Delete icon button | `<DeleteConfirmDialog>` — copy the pattern from `src/components/connections/DeleteConfirmDialog.tsx` |

**Empty state:** "No APIs yet — add your first API to get started." with a "New API" button.

**Loading:** shadcn `<Skeleton>` rows.

---

### 9.2 New API Wizard (`/apis/new`) — `src/pages/ApisNew.tsx`

Full-page layout with a "← APIs" back link. Step indicator at top.

---

#### Step 1 — Choose source

Two large option cards side by side:

**Card A — Search platform catalogue**
- Debounced search input → `useCatalogue(query)` 
- Results list: each hit shows `title`, `description`, operation count badge, server count badge, "Use this API" button
- "Use this API" → store the `hit.id` as `globalOpensearchId`, advance to Step 2A

**Card B — Register my own API**
- "Register my own" button → advance to Step 2B

---

#### Step 2A — Adopt platform API

Displays the selected catalogue hit (title, description, counts). Explanation text: "This API is managed by SLAOps. You'll always have the latest version automatically."

- "Adopt API" → `useAdoptApi()` with `{ globalOpensearchId }` → on success navigate to `/apis/:newId`
- "Back" → Step 1

---

#### Step 2B — Private API details

React Hook Form + Zod form:

| Field | Type | Required |
|---|---|---|
| Name | text | yes — max 255 |
| Description | textarea | no |
| External URL | url | no |
| Version strategy | radio: `manual` \| `url_fetch` | yes — default `manual` |
| Fetch URL _(if url_fetch)_ | url | yes |
| Fetch schedule _(if url_fetch)_ | text — cron | no — placeholder `0 2 * * *` |

Under the cron field show a static human-readable helper derived from the input (e.g. "Daily at 02:00 UTC").

- "Next" → `useCreateApi()` with form values
  - On success with `strategy === 'manual'` → advance to Step 3 with `newApi.id`
  - On success with `strategy === 'url_fetch'` → navigate to `/apis/:newApi.id`
- "Back" → Step 1

---

#### Step 3 — Upload initial spec

Two tabs:

**Tab: Upload file**
- Drag-and-drop + click area for `.yaml`, `.yml`, `.json`
- Shows filename + size once selected

**Tab: Paste content**
- Large monospace `<Textarea>` — "Paste your OpenAPI YAML or JSON here"

**"Upload and Index" / "Index" button flow:**
1. `useUploadUrl()` → `{ url, key, bucket }`
2. `PUT` the file content directly to `url` using plain `fetch` — **no Authorization header** (the pre-signed URL is already signed by S3)
3. `useIndexSpec()` with `{ apiId, bucket, key }` → `IndexingResponse`
4. Show `<IndexingResultPanel>` (see below)

**`<IndexingResultPanel>`** (on success):
```
✅ Indexed successfully
  Version: 3.1.0
  Operations: 142  Servers: 3  Parameters: 89  Models: 34
  Duration: 1.2s
```
On error, show `❌ Indexing failed` + list each `error.step: error.message` entry.

Button: "View API" → `/apis/:id`.

"Skip for now" link → `/apis/:id` (spec can be uploaded from the detail page).

---

### 9.3 API Detail (`/apis/:id`) — `src/pages/ApiDetail.tsx`

Call `useApi(id)`. Header: `api.name`, management mode badge, "Edit" button → `<EditApiDrawer>`.

Breadcrumb: **APIs** > `api.name`.

Tabs via shadcn `<Tabs>`. Active tab synced to `apisSlice.detailTab`.

---

#### Tab: Overview

Two-column card layout.

**API Details card:**

| Field | Value |
|---|---|
| Name | `api.name` |
| Description | `api.description` or _none_ |
| External URL | Clickable link, or _none_ |
| Management mode | badge |
| Version strategy | badge (private mode only) |
| Created | formatted date |

**Spec Stats card** (shown only when `api.oaSpec.latestVersion` is non-null):

| Field | Value |
|---|---|
| Latest version | `api.oaSpec.latestVersion` |
| Last indexed | relative time |
| Operations | `api.oaSpec.operationCount` |
| Servers | `api.oaSpec.serverCount` |
| Parameters | `api.oaSpec.parameterCount` |
| Models | `api.oaSpec.modelCount` |

**Upload spec card** (shown when `api.managementMode === 'private'`): drag-and-drop upload area running the same upload → index flow as Step 3 of the wizard. Always visible for manual strategy; shown as "Re-index" for apis that already have a spec.

**Fetch Status card** (shown when `api.fetch.strategy === VersionFetchStateStrategyEnum.UrlFetch`):

| Field | Value |
|---|---|
| Fetch URL | `api.fetch.url` |
| Schedule | `api.fetch.cron` + human-readable |
| Last fetched | relative time, or "Never" |
| Last status | badge: `ok` = green / `error` = red / `no_change` = gray. Use `VersionFetchStateLastStatusEnum` |
| Last error | shown if `lastStatus === 'error'` |

---

#### Tab: Versions

Show a placeholder: "Version history coming soon — run a new indexing pass to update." with a disabled "Diff" button.

---

#### Tab: Operations

Dispatch `setOperationsQuery` to `apisSlice` on search input change (debounced 300ms).

Table:

| Column | Value |
|---|---|
| Method | `<MethodBadge method={op.method} />` |
| Path | monospace text |
| Summary | text |
| Tags | small gray badges parsed from `tagsText` |
| Deprecated | ⚠ badge if `deprecated === true` |

Click a row → `<OperationDetailPanel>` (shadcn `<Sheet>` from right) showing: operationId, full description, path key, tags.

**Empty / placeholder state:** "Operations will appear here after the spec is indexed."

---

#### Tab: Servers

Table:

| Column | Value |
|---|---|
| URL | `rawUrl` — monospace |
| Host shape | `hostShape` — monospace, e.g. `cloudtrail.*.amazonaws.com` |
| Base path | `basePath` |
| Scheme | badge: `https` = green / `http` = yellow |

**Empty state:** "Servers will appear here after the spec is indexed."

---

#### Tab: Parameters

Search input dispatches `setParamsQuery`. Table:

| Column | Value |
|---|---|
| Name | monospace |
| Location | badge: `path` = blue / `query` = gray / `header` = purple / `cookie` = orange |
| Type | `schemaType` + `schemaFormat` if present (e.g. `string uuid`) |
| Required | ✓ |
| Deprecated | ⚠ if true |
| Description | truncated |

**Empty state:** "Parameters will appear here after the spec is indexed."

---

#### Tab: Models

Search input dispatches `setModelsQuery`. Table:

| Column | Value |
|---|---|
| Name | text |
| Type | `schemaType` badge |
| Used in | badges from `usedInText` split by space: `request` = blue / `response` = green |
| Description | truncated |

Click row → `<ModelDetailPanel>` (shadcn `<Sheet>`) showing `propertiesText` as a monospace code block (one property per line).

**Empty state:** "Models will appear here after the spec is indexed."

---

### 9.4 Edit API Drawer — `src/components/apis/EditApiDrawer.tsx`

shadcn `<Sheet>` from the right. Pre-filled from `ApiEntity`. Same fields as Step 2B.

Submit → `useUpdateApi()` → invalidate queries → close sheet → toast "API updated".

---

## 10. Method Badge

Use a lookup object — no ternary chains:

```typescript
// src/components/apis/MethodBadge.tsx
const METHOD_CLASSES: Record<string, string> = {
  GET:     'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  POST:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PUT:     'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DELETE:  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  PATCH:   'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  HEAD:    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  OPTIONS: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}
```

---

## 11. Component File Map

```
src/
├── pages/
│   ├── Apis.tsx
│   ├── ApisNew.tsx
│   └── ApiDetail.tsx
│
├── components/
│   └── apis/
│       ├── ApiTable.tsx
│       ├── ApiManagementModeBadge.tsx
│       ├── ApiStrategyBadge.tsx
│       ├── ApiStatsCard.tsx
│       ├── ApiFetchStatusCard.tsx
│       ├── SpecUploadCard.tsx
│       ├── IndexingResultPanel.tsx
│       ├── EditApiDrawer.tsx
│       ├── MethodBadge.tsx
│       ├── OperationsTab.tsx
│       ├── OperationDetailPanel.tsx
│       ├── ServersTab.tsx
│       ├── ParametersTab.tsx
│       ├── ModelsTab.tsx
│       ├── ModelDetailPanel.tsx
│       └── WizardCatalogueSearch.tsx
│
├── hooks/
│   ├── useApisApi.ts
│   └── useIndexerApi.ts
│
├── store/
│   └── apisSlice.ts
│
└── types/
    └── indexer.ts        ← PresignedUrlResult, IndexingResponse, CatalogueResponse
```

---

## 12. Error Handling

Always catch as `unknown` — existing portal convention:

```typescript
try {
  await someApiCall()
  toast({ title: 'Success', description: 'API created' })
} catch (error: unknown) {
  toast({
    title: 'Error',
    description: error instanceof Error ? error.message : 'Request failed',
    variant: 'destructive',
  })
}
```

---

## 13. Deferred (show "coming soon")

These search endpoints are not yet implemented on the backend — render placeholder states:

- Operations tab search (can show static table rows from the OpenSearch index once backend search is added)
- Parameters tab search
- Models tab search
- Versions diff button — render as disabled

Use consistent placeholder text: "Coming soon" or "{entity} will appear here after the spec is indexed."
