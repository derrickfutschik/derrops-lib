import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollapsedSections {
  apiMatch: boolean
  service: boolean
  server: boolean
  operation: boolean
  pathParams: boolean
  queryParams: boolean
  headerParams: boolean
  bodyParams: boolean
  validation: boolean
  previewRequestLine: boolean
  previewHeaders: boolean
  previewBody: boolean
  [key: string]: boolean
}

export interface ApiTesterState {
  collapsedSections: CollapsedSections
  rightPanelTab: 'match' | 'response' | 'preview'
  activeTab: string
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: ApiTesterState = {
  collapsedSections: {
    apiMatch: false,
    service: false,
    server: false,
    operation: false,
    pathParams: false,
    queryParams: false,
    headerParams: false,
    bodyParams: false,
    validation: false,
    previewRequestLine: false,
    previewHeaders: false,
    previewBody: false,
  },
  rightPanelTab: 'match',
  activeTab: 'params',
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const apiTesterSlice = createSlice({
  name: 'apiTester',
  initialState,
  reducers: {
    toggleSection(state, action: PayloadAction<string>) {
      const section = action.payload
      state.collapsedSections[section] = !state.collapsedSections[section]
    },
    setCollapsedSections(state, action: PayloadAction<Partial<CollapsedSections>>) {
      Object.assign(state.collapsedSections, action.payload)
    },
    setRightPanelTab(state, action: PayloadAction<'match' | 'response' | 'preview'>) {
      state.rightPanelTab = action.payload
    },
    setActiveTab(state, action: PayloadAction<string>) {
      state.activeTab = action.payload
    },
  },
})

export const { toggleSection, setCollapsedSections, setRightPanelTab, setActiveTab } =
  apiTesterSlice.actions

export const apiTesterReducer = apiTesterSlice.reducer

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectCollapsedSections = (state: RootState) => state.apiTester.collapsedSections
export const selectRightPanelTab = (state: RootState) => state.apiTester.rightPanelTab
export const selectActiveTab = (state: RootState) => state.apiTester.activeTab
