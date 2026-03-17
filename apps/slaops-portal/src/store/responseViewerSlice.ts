import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ColumnPref {
  id: string
  hidden: boolean
  sortDirection: 'asc' | 'desc' | null
}

interface JsonState {
  jmespathEnabled: boolean
  jmespathQuery: string
  jmespathMode: 'filter' | 'highlight'
  truncateValues: boolean
  uniqueFilter: boolean
}

interface TableState {
  sqlQuery: string
  sqlMode: 'filter' | 'highlight'
  joinColumn: string | null
  columns: ColumnPref[]
}

export interface ResponseViewerState {
  selectedView: 'json' | 'markdown' | 'table'
  json: JsonState
  table: TableState
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: ResponseViewerState = {
  selectedView: 'json',
  json: {
    jmespathEnabled: true,
    jmespathQuery: '',
    jmespathMode: 'filter',
    truncateValues: false,
    uniqueFilter: false,
  },
  table: {
    sqlQuery: '',
    sqlMode: 'filter',
    joinColumn: null,
    columns: [],
  },
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const responseViewerSlice = createSlice({
  name: 'responseViewer',
  initialState,
  reducers: {
    // View mode
    setSelectedView(state, action: PayloadAction<'json' | 'markdown' | 'table'>) {
      state.selectedView = action.payload
    },

    // JSON state
    setJmespathEnabled(state, action: PayloadAction<boolean>) {
      state.json.jmespathEnabled = action.payload
    },
    setJmespathQuery(state, action: PayloadAction<string>) {
      state.json.jmespathQuery = action.payload
    },
    setJmespathMode(state, action: PayloadAction<'filter' | 'highlight'>) {
      state.json.jmespathMode = action.payload
    },
    setTruncateValues(state, action: PayloadAction<boolean>) {
      state.json.truncateValues = action.payload
    },
    setUniqueFilter(state, action: PayloadAction<boolean>) {
      state.json.uniqueFilter = action.payload
    },

    // Table state
    setSqlQuery(state, action: PayloadAction<string>) {
      state.table.sqlQuery = action.payload
    },
    setSqlMode(state, action: PayloadAction<'filter' | 'highlight'>) {
      state.table.sqlMode = action.payload
    },
    setJoinColumn(state, action: PayloadAction<string | null>) {
      state.table.joinColumn = action.payload
    },

    /**
     * Reconcile columns: merges a new column list with existing preferences.
     * - Preserves hidden/sortDirection for columns that still exist.
     * - Adds defaults for new columns.
     * - Drops columns that are no longer present.
     */
    reconcileColumns(state, action: PayloadAction<string[]>) {
      const newIds = action.payload
      const existingMap = new Map(state.table.columns.map((c) => [c.id, c]))
      state.table.columns = newIds.map((id) => {
        const existing = existingMap.get(id)
        if (existing) return existing
        return { id, hidden: false, sortDirection: null }
      })
    },

    toggleColumnHidden(state, action: PayloadAction<string>) {
      const col = state.table.columns.find((c) => c.id === action.payload)
      if (col) col.hidden = !col.hidden
    },

    showAllColumns(state) {
      state.table.columns.forEach((c) => {
        c.hidden = false
      })
    },

    /**
     * Set the sort for a specific column. Clears all other sorts first
     * (single column sort model). Pass `direction: null` to clear sorting.
     */
    setColumnSort(state, action: PayloadAction<{ id: string; direction: 'asc' | 'desc' | null }>) {
      const { id, direction } = action.payload
      state.table.columns.forEach((c) => {
        c.sortDirection = c.id === id ? direction : null
      })
    },

    // Bulk JSON state update (used for backward compat initialization from props)
    setJsonState(state, action: PayloadAction<Partial<JsonState>>) {
      Object.assign(state.json, action.payload)
    },
  },
})

export const {
  setSelectedView,
  setJmespathEnabled,
  setJmespathQuery,
  setJmespathMode,
  setTruncateValues,
  setUniqueFilter,
  setSqlQuery,
  setSqlMode,
  setJoinColumn,
  reconcileColumns,
  toggleColumnHidden,
  showAllColumns,
  setColumnSort,
  setJsonState,
} = responseViewerSlice.actions

export const responseViewerReducer = responseViewerSlice.reducer

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectSelectedView = (state: RootState) => state.responseViewer.selectedView
export const selectJsonState = (state: RootState) => state.responseViewer.json
export const selectTableState = (state: RootState) => state.responseViewer.table

/** Returns the single column that has a non-null sortDirection, or null if none. */
export const selectActiveSortColumn = (state: RootState) => {
  const col = state.responseViewer.table.columns.find((c) => c.sortDirection !== null)
  return col ? { id: col.id, direction: col.sortDirection as 'asc' | 'desc' } : null
}

/** Returns a Set of hidden column ids. */
export const selectHiddenColumnIds = (state: RootState): Set<string> => {
  return new Set(
    state.responseViewer.table.columns.filter((c) => c.hidden).map((c) => c.id),
  )
}
