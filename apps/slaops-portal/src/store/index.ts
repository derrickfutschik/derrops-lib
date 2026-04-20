import { configureStore } from '@reduxjs/toolkit'
import { apiRequestReducer } from './apiRequestSlice'
import { apiTesterReducer } from './apiTesterSlice'
import { responseViewerReducer } from './responseViewerSlice'
import { apisReducer } from './apisSlice'
import { apiTabsReducer } from './apiTabsSlice'
import { newApiWizardReducer } from './newApiWizardSlice'

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
