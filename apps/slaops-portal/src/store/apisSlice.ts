import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { actionRegistry, ActionArea, ActionGroup } from './actionMeta'
import type { RootState } from './index'

type DetailTab = 'overview' | 'versions' | 'operations' | 'servers' | 'parameters' | 'models'

interface ApisState {
  wizardOpen: boolean
  wizardStep: number
  wizardPath: 'catalogue' | 'private' | null
  detailTab: DetailTab
}

const initialState: ApisState = {
  wizardOpen: false,
  wizardStep: 1,
  wizardPath: null,
  detailTab: 'overview',
}

const apisSlice = createSlice({
  name: 'apis',
  initialState,
  reducers: {
    setWizardOpen(state, action: PayloadAction<boolean>) {
      state.wizardOpen = action.payload
      if (!action.payload) {
        state.wizardStep = 1
        state.wizardPath = null
      }
    },
    setWizardStep(state, action: PayloadAction<number>) {
      state.wizardStep = action.payload
    },
    setWizardPath(state, action: PayloadAction<'catalogue' | 'private' | null>) {
      state.wizardPath = action.payload
    },
    setDetailTab(state, action: PayloadAction<DetailTab>) {
      state.detailTab = action.payload
    },
  },
})

export const {
  setWizardOpen,
  setWizardStep,
  setWizardPath,
  setDetailTab,
} = actionRegistry.registerAll(apisSlice.actions, {
  setWizardOpen: {
    description: 'Opens or closes the new API wizard. Resets step and path on close.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setWizardStep: {
    description: 'Sets the current step number (1, 2, or 3) of the new API wizard.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setWizardPath: {
    description: 'Sets the wizard path: catalogue (adopt) or private (register own).',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
  setDetailTab: {
    description: 'Sets the active tab on the API detail page.',
    area: ActionArea.UI,
    group: ActionGroup.Apis,
  },
})

export const apisReducer = apisSlice.reducer

export const selectWizardOpen = (state: RootState) => state.apis.wizardOpen
export const selectWizardStep = (state: RootState) => state.apis.wizardStep
export const selectWizardPath = (state: RootState) => state.apis.wizardPath
export const selectDetailTab = (state: RootState) => state.apis.detailTab
