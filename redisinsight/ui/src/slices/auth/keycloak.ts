import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../store'

export interface KeycloakUser {
  sub: string
  email?: string
  preferredUsername?: string
  roles: string[]
  groups: string[]
}

export interface StateKeycloakAuth {
  isEnabled: boolean
  isAuthenticated: boolean
  isLoading: boolean
  user: KeycloakUser | null
  error: string
}

export const initialState: StateKeycloakAuth = {
  isEnabled: false,
  isAuthenticated: false,
  isLoading: false,
  user: null,
  error: '',
}

const keycloakAuthSlice = createSlice({
  name: 'keycloakAuth',
  initialState,
  reducers: {
    setKeycloakEnabled: (state, { payload }: PayloadAction<boolean>) => {
      state.isEnabled = payload
    },
    setKeycloakLoading: (state, { payload }: PayloadAction<boolean>) => {
      state.isLoading = payload
    },
    setKeycloakAuthenticated: (
      state,
      { payload }: PayloadAction<KeycloakUser>,
    ) => {
      state.isAuthenticated = true
      state.isLoading = false
      state.error = ''
      state.user = payload
    },
    setKeycloakUnauthenticated: (state) => {
      state.isAuthenticated = false
      state.isLoading = false
      state.user = null
    },
    setKeycloakError: (state, { payload }: PayloadAction<string>) => {
      state.error = payload
      state.isLoading = false
    },
  },
})

export const {
  setKeycloakEnabled,
  setKeycloakLoading,
  setKeycloakAuthenticated,
  setKeycloakUnauthenticated,
  setKeycloakError,
} = keycloakAuthSlice.actions

export const keycloakAuthSelector = (state: RootState) =>
  state.keycloakAuth ?? initialState

export default keycloakAuthSlice.reducer
