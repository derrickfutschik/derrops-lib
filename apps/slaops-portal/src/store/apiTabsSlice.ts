/**
 * Redux slice for API detail tab view state — sort, pagination, column visibility,
 * and filters for the Versions, Operations, Servers, Parameters, and Models tabs.
 *
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/views/index.md
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ActionArea, ActionGroup, actionRegistry } from './actionMeta'
import type { RootState } from './index'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface SortState {
  field: string
  direction: 'asc' | 'desc'
}

interface BaseTabState {
  sort: SortState
  hiddenColumns: string[]
  page: number
}

interface ApiTabsState {
  selectedVersion: string | null // null = follow latest
  versions: BaseTabState
  operations: BaseTabState & { query: string; methodFilter: string[]; tagFilter: string | null }
  servers: BaseTabState
  parameters: BaseTabState & { query: string; locationFilter: string | null }
  models: BaseTabState & { query: string; usedInFilter: string | null }
}

type TabName = keyof Pick<
  ApiTabsState,
  'versions' | 'operations' | 'servers' | 'parameters' | 'models'
>

const initialState: ApiTabsState = {
  selectedVersion: null,
  versions: { sort: { field: 'indexedAt', direction: 'desc' }, hiddenColumns: [], page: 0 },
  operations: {
    sort: { field: 'path', direction: 'asc' },
    hiddenColumns: [],
    page: 0,
    query: '',
    methodFilter: [],
    tagFilter: null,
  },
  servers: { sort: { field: 'serverIndex', direction: 'asc' }, hiddenColumns: [], page: 0 },
  parameters: {
    sort: { field: 'name', direction: 'asc' },
    hiddenColumns: [],
    page: 0,
    query: '',
    locationFilter: null,
  },
  models: {
    sort: { field: 'name', direction: 'asc' },
    hiddenColumns: [],
    page: 0,
    query: '',
    usedInFilter: null,
  },
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const apiTabsSlice = createSlice({
  name: 'apiTabs',
  initialState,
  reducers: {
    setSelectedVersion(state, action: PayloadAction<string | null>) {
      state.selectedVersion = action.payload
      // Reset page on all tabs when version changes
      ;(['versions', 'operations', 'servers', 'parameters', 'models'] as TabName[]).forEach((t) => {
        state[t].page = 0
      })
    },
    resetAllTabs(state) {
      Object.assign(state, initialState)
    },
    setTabSort(
      state,
      action: PayloadAction<{ tab: TabName; field: string; direction: 'asc' | 'desc' }>,
    ) {
      const { tab, field, direction } = action.payload
      state[tab].sort = { field, direction }
      state[tab].page = 0
    },
    setTabPage(state, action: PayloadAction<{ tab: TabName; page: number }>) {
      const { tab, page } = action.payload
      state[tab].page = page
    },
    toggleTabColumn(state, action: PayloadAction<{ tab: TabName; column: string }>) {
      const { tab, column } = action.payload
      const cols = state[tab].hiddenColumns
      const idx = cols.indexOf(column)
      if (idx === -1) cols.push(column)
      else cols.splice(idx, 1)
    },
    showAllTabColumns(state, action: PayloadAction<{ tab: TabName }>) {
      state[action.payload.tab].hiddenColumns = []
    },
    setOperationsQuery(state, action: PayloadAction<string>) {
      state.operations.query = action.payload
      state.operations.page = 0
    },
    setOperationsMethodFilter(state, action: PayloadAction<string[]>) {
      state.operations.methodFilter = action.payload
      state.operations.page = 0
    },
    setOperationsTagFilter(state, action: PayloadAction<string | null>) {
      state.operations.tagFilter = action.payload
      state.operations.page = 0
    },
    setParametersQuery(state, action: PayloadAction<string>) {
      state.parameters.query = action.payload
      state.parameters.page = 0
    },
    setParametersLocationFilter(state, action: PayloadAction<string | null>) {
      state.parameters.locationFilter = action.payload
      state.parameters.page = 0
    },
    setModelsQuery(state, action: PayloadAction<string>) {
      state.models.query = action.payload
      state.models.page = 0
    },
    setModelsUsedInFilter(state, action: PayloadAction<string | null>) {
      state.models.usedInFilter = action.payload
      state.models.page = 0
    },
  },
})

export const {
  setSelectedVersion,
  resetAllTabs,
  setTabSort,
  setTabPage,
  toggleTabColumn,
  showAllTabColumns,
  setOperationsQuery,
  setOperationsMethodFilter,
  setOperationsTagFilter,
  setParametersQuery,
  setParametersLocationFilter,
  setModelsQuery,
  setModelsUsedInFilter,
} = actionRegistry.registerAll(apiTabsSlice.actions, {
  setSelectedVersion: {
    description: 'Pins a specific spec version for all detail tabs; null reverts to latest.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  resetAllTabs: {
    description: 'Resets all tab state to defaults — called when navigating to a different API.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setTabSort: {
    description: 'Sets the sort field and direction for a specific detail tab.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setTabPage: {
    description: 'Sets the current page number for a specific detail tab.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  toggleTabColumn: {
    description: 'Toggles visibility of a column in a specific detail tab.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  showAllTabColumns: {
    description: 'Restores all hidden columns in a specific detail tab.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setOperationsQuery: {
    description: 'Sets the free-text search query for the operations tab.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setOperationsMethodFilter: {
    description: 'Sets the HTTP method filter for the operations tab.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setOperationsTagFilter: {
    description: 'Sets the tag filter for the operations tab.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setParametersQuery: {
    description: 'Sets the free-text search query for the parameters tab.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setParametersLocationFilter: {
    description: 'Sets the parameter location filter (path/query/header/cookie).',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setModelsQuery: {
    description: 'Sets the free-text search query for the models tab.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setModelsUsedInFilter: {
    description: 'Sets the "used in" filter (request/response) for the models tab.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
})

export const apiTabsReducer = apiTabsSlice.reducer

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectSelectedVersion = (state: RootState) => state.apiTabs.selectedVersion
export const selectVersionsTabState = (state: RootState) => state.apiTabs.versions
export const selectOperationsTabState = (state: RootState) => state.apiTabs.operations
export const selectServersTabState = (state: RootState) => state.apiTabs.servers
export const selectParametersTabState = (state: RootState) => state.apiTabs.parameters
export const selectModelsTabState = (state: RootState) => state.apiTabs.models
