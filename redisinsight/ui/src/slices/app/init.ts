import { createSlice } from '@reduxjs/toolkit'
import { fetchCsrfTokenAction } from 'uiSrc/slices/app/csrf'
import { fetchFeatureFlags } from 'uiSrc/slices/app/features'
import { FeatureFlags } from 'uiSrc/constants'
import { fetchCloudUserProfile } from 'uiSrc/slices/user/cloud-user-profile'
import {
  isKeycloakEnabled,
  getStoredAccessToken,
  parseJwtPayload,
  clearStoredTokens,
} from 'uiSrc/services/keycloakAuthService'
import {
  setKeycloakEnabled,
  setKeycloakAuthenticated,
} from 'uiSrc/slices/auth/keycloak'
import { AppDispatch, RootState } from '../store'

export const STATUS_INITIAL = 'initial'
export const STATUS_LOADING = 'loading'
export const STATUS_SUCCESS = 'success'
export const STATUS_FAIL = 'fail'
const appStatus = [
  STATUS_INITIAL,
  STATUS_LOADING,
  STATUS_SUCCESS,
  STATUS_FAIL,
] as const

export const FAILED_TO_FETCH_CSRF_TOKEN_ERROR = 'Failed to fetch CSRF token'
export const FAILED_TO_FETCH_FEATURE_FLAGS_ERROR =
  'Failed to fetch feature flags'
export const FAILED_TO_FETCH_USER_PROFILE_ERROR = 'Failed to fetch user profile'

export const initialState: {
  status: (typeof appStatus)[number]
  error?: string
} = {
  status: STATUS_INITIAL,
}

const appInitSlice = createSlice({
  name: 'init',
  initialState,
  reducers: {
    initializeAppState: (state) => {
      state.status = STATUS_LOADING
    },
    initializeAppStateSuccess: (state) => {
      state.status = STATUS_SUCCESS
    },
    initializeAppStateFail: (
      state,
      {
        payload,
      }: {
        payload: {
          error: string
        }
      },
    ) => {
      state.status = STATUS_FAIL
      state.error = payload.error
    },
  },
})

export const {
  initializeAppState,
  initializeAppStateSuccess,
  initializeAppStateFail,
} = appInitSlice.actions

export const appInitSelector = (state: RootState) => state.app.init

export default appInitSlice.reducer

/**
 * Initialize the app by fetching REQUIRED data.
 *
 * @param onSuccessAction - Called when the app is successfully initialized.
 * @param onFailAction - Called when there is an error while initializing the app.
 *
 */
export function initializeAppAction(
  onSuccessAction?: () => void,
  onFailAction?: () => void,
) {
  return async (dispatch: AppDispatch) => {
    try {
      dispatch(initializeAppState())
      dispatch(setKeycloakEnabled(isKeycloakEnabled()))

      // Restore authenticated state from stored Keycloak token on page refresh
      if (isKeycloakEnabled()) {
        const storedToken = getStoredAccessToken()
        if (storedToken) {
          try {
            const payload = parseJwtPayload(storedToken)
            const exp = payload.exp as number | undefined
            if (exp && exp * 1000 > Date.now()) {
              const realmAccess = payload.realm_access as
                | { roles?: string[] }
                | undefined
              dispatch(
                setKeycloakAuthenticated({
                  sub: payload.sub as string,
                  email: payload.email as string | undefined,
                  preferredUsername: payload.preferred_username as
                    | string
                    | undefined,
                  roles: realmAccess?.roles ?? [],
                  groups: Array.isArray(payload.groups)
                    ? (payload.groups as string[])
                    : [],
                }),
              )
            } else {
              clearStoredTokens()
            }
          } catch {
            clearStoredTokens()
          }
        }
      }

      await dispatch(
        fetchCsrfTokenAction(undefined, () => {
          throw new Error(FAILED_TO_FETCH_CSRF_TOKEN_ERROR)
        }),
      )

      await dispatch(
        fetchFeatureFlags(
          async (flagsData) => {
            const { [FeatureFlags.envDependent]: envDependent } =
              flagsData.features
            if (!envDependent?.flag) {
              await dispatch(
                fetchCloudUserProfile(undefined, () => {
                  throw new Error(FAILED_TO_FETCH_USER_PROFILE_ERROR)
                }),
              )
            }

            dispatch(initializeAppStateSuccess())
            onSuccessAction?.()
          },
          () => {
            throw new Error(FAILED_TO_FETCH_FEATURE_FLAGS_ERROR)
          },
        ),
      )
    } catch (error: any) {
      dispatch(initializeAppStateFail({ error: error?.message || '' }))
      onFailAction?.()
    }
  }
}
