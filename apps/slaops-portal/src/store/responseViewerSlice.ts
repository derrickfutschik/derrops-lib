import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { attachMeta } from './actionMeta'
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
  joiningEnabled: boolean
  additionalJoinPaths: (string | null)[]
}

export interface ResponseViewerState {
  selectedView: 'json' | 'markdown' | 'table'
  highlightDuplicates: boolean
  json: JsonState
  table: TableState
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: ResponseViewerState = {
  selectedView: 'json',
  highlightDuplicates: false,
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
    joiningEnabled: false,
    additionalJoinPaths: [],
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

    setHighlightDuplicates(state, action: PayloadAction<boolean>) {
      state.highlightDuplicates = action.payload
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
    setJoiningEnabled(state, action: PayloadAction<boolean>) {
      state.table.joiningEnabled = action.payload
    },
    setAdditionalJoinPaths(state, action: PayloadAction<(string | null)[]>) {
      state.table.additionalJoinPaths = action.payload
    },

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

    setColumnSort(state, action: PayloadAction<{ id: string; direction: 'asc' | 'desc' | null }>) {
      const { id, direction } = action.payload
      state.table.columns.forEach((c) => {
        c.sortDirection = c.id === id ? direction : null
      })
    },

    setJsonState(state, action: PayloadAction<Partial<JsonState>>) {
      Object.assign(state.json, action.payload)
    },
  },
})

export const {
  setSelectedView,
  setHighlightDuplicates,
  setJmespathEnabled,
  setJmespathQuery,
  setJmespathMode,
  setTruncateValues,
  setUniqueFilter,
  setSqlQuery,
  setSqlMode,
  setJoinColumn,
  setJoiningEnabled,
  setAdditionalJoinPaths,
  reconcileColumns,
  toggleColumnHidden,
  showAllColumns,
  setColumnSort,
  setJsonState,
} = responseViewerSlice.actions

attachMeta(setSelectedView, {
  description: "Sets the active response viewer mode ('json', 'markdown', or 'table').",
  area: 'response',
  group: 'view-mode',
})
attachMeta(setHighlightDuplicates, {
  description: 'Enables or disables highlighting of duplicate values across the response.',
  area: 'response',
  group: 'view-mode',
})
attachMeta(setJmespathEnabled, {
  description: 'Enables or disables the JMESPath query input in the JSON viewer.',
  area: 'response',
  group: 'json',
})
attachMeta(setJmespathQuery, {
  description: 'Sets the JMESPath expression used to filter or highlight nodes in the JSON viewer.',
  area: 'response',
  group: 'json',
})
attachMeta(setJmespathMode, {
  description: "Sets whether the JMESPath expression filters nodes out ('filter') or highlights matching nodes ('highlight').",
  area: 'response',
  group: 'json',
})
attachMeta(setTruncateValues, {
  description: 'Enables or disables truncation of long string values in the JSON viewer.',
  area: 'response',
  group: 'json',
})
attachMeta(setUniqueFilter, {
  description: 'Enables or disables filtering the JSON view to show only unique values.',
  area: 'response',
  group: 'json',
})
attachMeta(setJsonState, {
  description: 'Bulk-updates multiple JSON viewer state properties at once. Used for backward-compatible initialization from props.',
  area: 'response',
  group: 'json',
})
attachMeta(setSqlQuery, {
  description: 'Sets the SQL expression used to filter or highlight rows in the table viewer.',
  area: 'response',
  group: 'table',
})
attachMeta(setSqlMode, {
  description: "Sets whether the SQL expression filters rows out ('filter') or highlights matching rows ('highlight').",
  area: 'response',
  group: 'table',
})
attachMeta(setJoinColumn, {
  description: 'Sets the column key used as the join key when merging a secondary data source into the table.',
  area: 'response',
  group: 'table',
})
attachMeta(setJoiningEnabled, {
  description: 'Enables or disables the table join feature that merges a secondary data source alongside the primary response.',
  area: 'response',
  group: 'table',
})
attachMeta(setAdditionalJoinPaths, {
  description: 'Sets the list of additional JSON paths used to locate join data within the secondary source.',
  area: 'response',
  group: 'table',
})
attachMeta(reconcileColumns, {
  description: 'Merges a new column list with existing preferences: preserves hidden/sort state for existing columns, adds defaults for new ones, and drops removed columns.',
  area: 'response',
  group: 'table-columns',
})
attachMeta(toggleColumnHidden, {
  description: 'Toggles the visibility of the column with the given id.',
  area: 'response',
  group: 'table-columns',
})
attachMeta(showAllColumns, {
  description: 'Clears the hidden flag on every column, making all columns visible.',
  area: 'response',
  group: 'table-columns',
})
attachMeta(setColumnSort, {
  description: 'Sets the sort direction for a specific column (single-column sort model). Clears all other column sorts. Pass direction: null to remove sorting.',
  area: 'response',
  group: 'table-columns',
})

export const responseViewerReducer = responseViewerSlice.reducer

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectSelectedView = (state: RootState) => state.responseViewer.selectedView
export const selectHighlightDuplicates = (state: RootState) => state.responseViewer.highlightDuplicates
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
