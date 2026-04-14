import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { actionRegistry, ActionArea, ActionGroup } from './actionMeta'
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

export interface FocusedQueryParam {
  index: number
  field: 'key' | 'value'
}

export interface ApiTesterState {
  collapsedSections: CollapsedSections
  rightPanelTab: 'match' | 'response' | 'preview'
  activeTab: string
  focusedQueryParam: FocusedQueryParam | null
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
  focusedQueryParam: null,
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
    setFocusedQueryParam(state, action: PayloadAction<FocusedQueryParam>) {
      state.focusedQueryParam = action.payload
    },
    clearFocusedQueryParam(state) {
      state.focusedQueryParam = null
    },
  },
})

export const {
  toggleSection,
  setCollapsedSections,
  setRightPanelTab,
  setActiveTab,
  setFocusedQueryParam,
  clearFocusedQueryParam,
} = actionRegistry.registerAll(apiTesterSlice.actions, {
  toggleSection: {
    description: 'Toggles the collapsed/expanded state of a named section in the API tester UI.',
    area: ActionArea.Request,
    group: ActionGroup.Layout,
  },
  setCollapsedSections: {
    description: 'Partially updates the collapsed state of one or more sections without affecting others.',
    area: ActionArea.Request,
    group: ActionGroup.Layout,
  },
  setRightPanelTab: {
    description: "Sets the active tab in the right panel ('match', 'response', or 'preview').",
    area: ActionArea.Request,
    group: ActionGroup.Navigation,
  },
  setActiveTab: {
    description: "Sets the active tab in the main API tester tab bar (e.g. 'params', 'headers', 'body').",
    area: ActionArea.Request,
    group: ActionGroup.Navigation,
  },
  setFocusedQueryParam: {
    description: 'Records which query param field (key or value) the user is currently editing, so the URL bar can highlight the corresponding segment.',
    area: ActionArea.Request,
    group: ActionGroup.Navigation,
  },
  clearFocusedQueryParam: {
    description: 'Clears the focused query param highlight when the user leaves a param field.',
    area: ActionArea.Request,
    group: ActionGroup.Navigation,
  },
})

export const apiTesterReducer = apiTesterSlice.reducer

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectCollapsedSections = (state: RootState) => state.apiTester.collapsedSections
export const selectRightPanelTab = (state: RootState) => state.apiTester.rightPanelTab
export const selectActiveTab = (state: RootState) => state.apiTester.activeTab
export const selectFocusedQueryParam = (state: RootState) => state.apiTester.focusedQueryParam
