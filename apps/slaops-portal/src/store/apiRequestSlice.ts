import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ActionArea, ActionGroup, actionRegistry } from './actionMeta'
import type { RootState } from './index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  duration: number
  relayConnectionName?: string
  relayDeliveryMode?: string
}

interface ApiRequestState {
  isSendingRequest: boolean
  requestResponse: RequestResponse | null
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: ApiRequestState = {
  isSendingRequest: false,
  requestResponse: null,
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const apiRequestSlice = createSlice({
  name: 'apiRequest',
  initialState,
  reducers: {
    setIsSendingRequest(state, action: PayloadAction<boolean>) {
      state.isSendingRequest = action.payload
    },
    setRequestResponse(state, action: PayloadAction<RequestResponse | null>) {
      state.requestResponse = action.payload
    },
    clearResponse(state) {
      state.requestResponse = null
      state.isSendingRequest = false
    },
  },
})

export const { setIsSendingRequest, setRequestResponse, clearResponse } =
  actionRegistry.registerAll(apiRequestSlice.actions, {
    setIsSendingRequest: {
      description: 'Sets whether an API request is currently in-flight.',
      area: ActionArea.Request,
      group: ActionGroup.SendRequest,
    },
    setRequestResponse: {
      description: 'Stores the response received from the last API request or relay job.',
      area: ActionArea.Request,
      group: ActionGroup.SendRequest,
    },
    clearResponse: {
      description: 'Clears the stored response and resets the sending state.',
      area: ActionArea.Request,
      group: ActionGroup.SendRequest,
    },
  })

export const apiRequestReducer = apiRequestSlice.reducer

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectIsSendingRequest = (state: RootState) => state.apiRequest.isSendingRequest
export const selectRequestResponse = (state: RootState) => state.apiRequest.requestResponse
