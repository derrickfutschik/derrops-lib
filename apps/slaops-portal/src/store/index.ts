import { configureStore } from '@reduxjs/toolkit'
import { apiRequestReducer } from './apiRequestSlice'
import { apisReducer } from './apisSlice'
import { apiTabsReducer } from './apiTabsSlice'
import { apiTesterReducer } from './apiTesterSlice'
import { newApiWizardReducer } from './newApiWizardSlice'
import { responseViewerReducer } from './responseViewerSlice'

export const store = configureStore({
  reducer: {
    responseViewer: responseViewerReducer,
    apiTester: apiTesterReducer,
    apiRequest: apiRequestReducer,
    apis: apisReducer,
    apiTabs: apiTabsReducer,
    newApiWizard: newApiWizardReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
