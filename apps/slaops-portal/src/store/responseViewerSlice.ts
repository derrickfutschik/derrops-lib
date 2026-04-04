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
    /** Sets the active response viewer mode ('json', 'markdown', or 'table'). */
    setSelectedView(state, action: PayloadAction<'json' | 'markdown' | 'table'>) {
      state.selectedView = action.payload
    },

    /** Enables or disables highlighting of duplicate values across the response. */
    setHighlightDuplicates(state, action: PayloadAction<boolean>) {
      state.highlightDuplicates = action.payload
    },

    // JSON state
    /** Enables or disables the JMESPath query input in the JSON viewer. */
    setJmespathEnabled(state, action: PayloadAction<boolean>) {
      state.json.jmespathEnabled = action.payload
    },
    /** Sets the JMESPath expression used to filter or highlight nodes in the JSON viewer. */
    setJmespathQuery(state, action: PayloadAction<string>) {
      state.json.jmespathQuery = action.payload
    },
    /** Sets whether the JMESPath expression filters rows out ('filter') or highlights matching nodes ('highlight'). */
    setJmespathMode(state, action: PayloadAction<'filter' | 'highlight'>) {
      state.json.jmespathMode = action.payload
    },
    /** Enables or disables truncation of long string values in the JSON viewer. */
    setTruncateValues(state, action: PayloadAction<boolean>) {
      state.json.truncateValues = action.payload
    },
    /** Enables or disables filtering the JSON view to show only unique values. */
    setUniqueFilter(state, action: PayloadAction<boolean>) {
      state.json.uniqueFilter = action.payload
    },

    // Table state
    /** Sets the SQL expression used to filter or highlight rows in the table viewer. */
    setSqlQuery(state, action: PayloadAction<string>) {
      state.table.sqlQuery = action.payload
    },
    /** Sets whether the SQL expression filters rows out ('filter') or highlights matching rows ('highlight'). */
    setSqlMode(state, action: PayloadAction<'filter' | 'highlight'>) {
      state.table.sqlMode = action.payload
    },
    /** Sets the column key used as the join key when merging a secondary data source into the table. */
    setJoinColumn(state, action: PayloadAction<string | null>) {
      state.table.joinColumn = action.payload
    },
    /** Enables or disables the table join feature that merges a secondary data source alongside the primary response. */
    setJoiningEnabled(state, action: PayloadAction<boolean>) {
      state.table.joiningEnabled = action.payload
    },
    /** Sets the list of additional JSON paths used to locate join data within the secondary source. */
    setAdditionalJoinPaths(state, action: PayloadAction<(string | null)[]>) {
      state.table.additionalJoinPaths = action.payload
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

    /** Toggles the visibility of the column with the given id. */
    toggleColumnHidden(state, action: PayloadAction<string>) {
      const col = state.table.columns.find((c) => c.id === action.payload)
      if (col) col.hidden = !col.hidden
    },

    /** Clears the hidden flag on every column, making all columns visible. */
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

    /** Bulk-updates multiple JSON viewer state properties at once. Used for backward-compatible initialization from props. */
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
