import { configureStore } from '@reduxjs/toolkit'
import { apiTesterReducer } from './apiTesterSlice'
import { responseViewerReducer } from './responseViewerSlice'

export const store = configureStore({
  reducer: {
    responseViewer: responseViewerReducer,
    apiTester: apiTesterReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
