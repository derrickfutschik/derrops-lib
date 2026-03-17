import { configureStore } from '@reduxjs/toolkit'
import { responseViewerReducer } from './responseViewerSlice'

export const store = configureStore({
  reducer: {
    responseViewer: responseViewerReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
