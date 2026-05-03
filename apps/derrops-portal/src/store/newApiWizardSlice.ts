import type { CatalogueHit } from '@/types/indexer'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ActionArea, ActionGroup, actionRegistry } from './actionMeta'
import type { RootState } from './index'

export interface OpenApiInfoResult {
  title: string
  description?: string
  version?: string
  rawContent?: string
}

type InfoFetchStatus = 'idle' | 'loading' | 'success' | 'error'

interface NewApiWizardState {
  step: number
  path: 'catalogue' | 'private' | null
  selectedCatalogueHit: CatalogueHit | null
  infoFetchStatus: InfoFetchStatus
  infoFetchUrl: string | null
  infoFetchResult: OpenApiInfoResult | null
  lastAutoPopulatedName: string | null
  lastAutoPopulatedDescription: string | null
  createdApiId: string | null
}

const initialState: NewApiWizardState = {
  step: 1,
  path: null,
  selectedCatalogueHit: null,
  infoFetchStatus: 'idle',
  infoFetchUrl: null,
  infoFetchResult: null,
  lastAutoPopulatedName: null,
  lastAutoPopulatedDescription: null,
  createdApiId: null,
}

const newApiWizardSlice = createSlice({
  name: 'newApiWizard',
  initialState,
  reducers: {
    setStep(state, action: PayloadAction<number>) {
      state.step = action.payload
    },
    setPath(state, action: PayloadAction<'catalogue' | 'private' | null>) {
      state.path = action.payload
    },
    setSelectedCatalogueHit(state, action: PayloadAction<CatalogueHit | null>) {
      state.selectedCatalogueHit = action.payload
    },
    setInfoFetchStatus(state, action: PayloadAction<InfoFetchStatus>) {
      state.infoFetchStatus = action.payload
    },
    setInfoFetchUrl(state, action: PayloadAction<string | null>) {
      state.infoFetchUrl = action.payload
    },
    setInfoFetchResult(state, action: PayloadAction<OpenApiInfoResult | null>) {
      state.infoFetchResult = action.payload
    },
    setLastAutoPopulated(
      state,
      action: PayloadAction<{ name: string | null; description: string | null }>,
    ) {
      state.lastAutoPopulatedName = action.payload.name
      state.lastAutoPopulatedDescription = action.payload.description
    },
    setCreatedApiId(state, action: PayloadAction<string>) {
      state.createdApiId = action.payload
    },
    resetWizard() {
      return initialState
    },
  },
})

export const {
  setStep,
  setPath,
  setSelectedCatalogueHit,
  setInfoFetchStatus,
  setInfoFetchUrl,
  setInfoFetchResult,
  setLastAutoPopulated,
  setCreatedApiId,
  resetWizard,
} = actionRegistry.registerAll(newApiWizardSlice.actions, {
  setStep: {
    description: 'Sets the current step of the New API wizard (1, 2, or 3).',
    area: ActionArea.UI,
    group: ActionGroup.NewApiWizard,
  },
  setPath: {
    description: "Sets the wizard path: 'catalogue' (adopt) or 'private' (register own).",
    area: ActionArea.UI,
    group: ActionGroup.NewApiWizard,
  },
  setSelectedCatalogueHit: {
    description: 'Stores the catalogue hit chosen in step 1 for the adopt path.',
    area: ActionArea.UI,
    group: ActionGroup.NewApiWizard,
  },
  setInfoFetchStatus: {
    description: 'Sets the status of the GET /apis/info fetch: idle | loading | success | error.',
    area: ActionArea.UI,
    group: ActionGroup.NewApiWizard,
  },
  setInfoFetchUrl: {
    description: 'Stores the URL that was used for the GET /apis/info fetch.',
    area: ActionArea.UI,
    group: ActionGroup.NewApiWizard,
  },
  setInfoFetchResult: {
    description: 'Stores the fetched OpenAPI info block (title, description, version) or null.',
    area: ActionArea.UI,
    group: ActionGroup.NewApiWizard,
  },
  setLastAutoPopulated: {
    description:
      'Records the last name and description values that were auto-populated from a fetch result, used to guard against overwriting user edits.',
    area: ActionArea.UI,
    group: ActionGroup.NewApiWizard,
  },
  setCreatedApiId: {
    description: 'Stores the id of the newly created API after step 2B submission.',
    area: ActionArea.UI,
    group: ActionGroup.NewApiWizard,
  },
  resetWizard: {
    description: 'Resets all wizard state back to initial (step 1, no path, no selections).',
    area: ActionArea.UI,
    group: ActionGroup.NewApiWizard,
  },
})

export const newApiWizardReducer = newApiWizardSlice.reducer

export const selectWizardStep = (state: RootState) => state.newApiWizard.step
export const selectWizardPath = (state: RootState) => state.newApiWizard.path
export const selectSelectedCatalogueHit = (state: RootState) =>
  state.newApiWizard.selectedCatalogueHit
export const selectInfoFetchStatus = (state: RootState) => state.newApiWizard.infoFetchStatus
export const selectInfoFetchUrl = (state: RootState) => state.newApiWizard.infoFetchUrl
export const selectInfoFetchResult = (state: RootState) => state.newApiWizard.infoFetchResult
export const selectLastAutoPopulated = (state: RootState) => ({
  name: state.newApiWizard.lastAutoPopulatedName,
  description: state.newApiWizard.lastAutoPopulatedDescription,
})
export const selectCreatedApiId = (state: RootState) => state.newApiWizard.createdApiId
export const selectSpecContent = (state: RootState) =>
  state.newApiWizard.infoFetchResult?.rawContent ?? null
