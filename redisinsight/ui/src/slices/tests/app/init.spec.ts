import { cloneDeep } from 'lodash'
import { http, HttpResponse } from 'msw'
import reducer, {
  appInitSelector,
  FAILED_TO_FETCH_CSRF_TOKEN_ERROR,
  FAILED_TO_FETCH_FEATURE_FLAGS_ERROR,
  initializeAppAction,
  initializeAppState,
  initializeAppStateFail,
  initializeAppStateSuccess,
  initialState,
  STATUS_FAIL,
  STATUS_LOADING,
  STATUS_SUCCESS,
} from 'uiSrc/slices/app/init'
import {
  cleanup,
  getMswURL,
  initialStateDefault,
  mockedStore,
  waitFor,
} from 'uiSrc/utils/test-utils'
import {
  getFeatureFlags,
  getFeatureFlagsFailure,
  getFeatureFlagsSuccess,
} from 'uiSrc/slices/app/features'
import { getConfig } from 'uiSrc/config'
import {
  CSRFTokenResponse,
  fetchCsrfToken,
  fetchCsrfTokenFail,
} from 'uiSrc/slices/app/csrf'
import { FEATURES_DATA_MOCK } from 'uiSrc/mocks/handlers/app/featureHandlers'
import { ApiEndpoints } from 'uiSrc/constants'
import { mswServer } from 'uiSrc/mocks/server'
import {
  getUserProfile,
  getUserProfileSuccess,
} from 'uiSrc/slices/user/cloud-user-profile'
import { CLOUD_ME_DATA_MOCK } from 'uiSrc/mocks/handlers/oauth/cloud'
import {
  setKeycloakEnabled,
  setKeycloakAuthenticated,
} from 'uiSrc/slices/auth/keycloak'
import * as keycloakAuthService from 'uiSrc/services/keycloakAuthService'

const riConfig = getConfig()

let store: typeof mockedStore
beforeEach(() => {
  cleanup()
  store = cloneDeep(mockedStore)
  store.clearActions()
  jest.spyOn(keycloakAuthService, 'isKeycloakEnabled').mockReturnValue(false)
  jest.spyOn(keycloakAuthService, 'getStoredAccessToken').mockReturnValue(null)
  jest.spyOn(keycloakAuthService, 'parseJwtPayload').mockReturnValue({})
  jest.spyOn(keycloakAuthService, 'clearStoredTokens').mockImplementation()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('init slice', () => {
  describe('initializeAppState', () => {
    it('should properly initialize app state', () => {
      const state = {
        ...initialState,
        status: STATUS_LOADING,
      }

      // Act
      const nextState = reducer(initialState, initializeAppState())

      // Assert
      const rootState = Object.assign(initialStateDefault, {
        app: { init: nextState },
      })

      expect(appInitSelector(rootState)).toEqual(state)
    })
  })

  describe('initializeAppStateSuccess', () => {
    it('should have success state', () => {
      const state = {
        ...initialState,
        status: STATUS_SUCCESS,
      }

      // Act
      const nextState = reducer(initialState, initializeAppStateSuccess())

      // Assert
      const rootState = Object.assign(initialStateDefault, {
        app: { init: nextState },
      })

      expect(appInitSelector(rootState)).toEqual(state)
    })
  })

  describe('initializeAppStateFail', () => {
    it('should have fail state', () => {
      const state = {
        ...initialState,
        status: STATUS_FAIL,
        error: FAILED_TO_FETCH_CSRF_TOKEN_ERROR,
      }

      // Act
      const nextState = reducer(
        initialState,
        initializeAppStateFail({
          error: FAILED_TO_FETCH_CSRF_TOKEN_ERROR,
        }),
      )

      // Assert
      const rootState = Object.assign(initialStateDefault, {
        app: { init: nextState },
      })

      expect(appInitSelector(rootState)).toEqual(state)
    })
  })

  describe('initApp', () => {
    it('succeed to init data', async () => {
      // Act
      await store.dispatch<any>(initializeAppAction())

      // Assert
      const expectedActions = [
        initializeAppState(),
        setKeycloakEnabled(false),
        getFeatureFlags(),
        getFeatureFlagsSuccess(FEATURES_DATA_MOCK),
        initializeAppStateSuccess(),
      ]

      expect(store.getActions()).toEqual(expectedActions)
    })

    it('failed to init data', async () => {
      mswServer.use(
        http.get<any, (typeof FEATURES_DATA_MOCK)[]>(
          getMswURL(ApiEndpoints.FEATURES),
          async () => {
            return HttpResponse.text('', { status: 500 })
          },
        ),
      )

      // Act
      await store.dispatch<any>(initializeAppAction())

      // Assert
      const expectedActions = [
        initializeAppState(),
        setKeycloakEnabled(false),
        getFeatureFlags(),
        getFeatureFlagsFailure(),
        initializeAppStateFail({ error: FAILED_TO_FETCH_FEATURE_FLAGS_ERROR }),
      ]

      expect(store.getActions()).toEqual(expectedActions)
    })

    it('failed to init csrf', async () => {
      riConfig.api.csrfEndpoint = 'csrf'
      mswServer.use(
        http.get<any, CSRFTokenResponse | { message: string }>(
          getMswURL(riConfig.api.csrfEndpoint),
          async () => {
            return HttpResponse.text('', { status: 500 })
          },
        ),
      )

      // Act
      await store.dispatch<any>(initializeAppAction())

      // Assert
      const expectedActions = [
        initializeAppState(),
        setKeycloakEnabled(false),
        fetchCsrfToken(),
        fetchCsrfTokenFail({ error: 'Request failed with status code 500' }),
        initializeAppStateFail({ error: FAILED_TO_FETCH_CSRF_TOKEN_ERROR }),
      ]

      expect(store.getActions()).toEqual(expectedActions)
    })

    it('fetches user profile if !envDependent', async () => {
      riConfig.api.csrfEndpoint = ''

      const newFeatureFlags = {
        features: {
          ...FEATURES_DATA_MOCK.features,
          envDependent: {
            name: 'envDependent',
            flag: false,
          },
        },
      }

      // Arrange
      mswServer.use(
        http.get<any, (typeof FEATURES_DATA_MOCK)[]>(
          getMswURL(ApiEndpoints.FEATURES),
          async () => {
            return HttpResponse.json(newFeatureFlags, { status: 200 })
          },
        ),
      )

      // Act
      await store.dispatch<any>(initializeAppAction())

      // Assert
      const expectedActions = [
        initializeAppState(),
        setKeycloakEnabled(false),
        getFeatureFlags(),
        getFeatureFlagsSuccess(newFeatureFlags),
        getUserProfile(),
        getUserProfileSuccess(CLOUD_ME_DATA_MOCK),
        initializeAppStateSuccess(),
      ]

      await waitFor(() => {
        expect(store.getActions()).toEqual(expectedActions)
      })
    })

    it('restores Keycloak auth state from a valid stored token on page refresh', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        preferred_username: 'testuser',
        exp: futureExp,
        realm_access: { roles: ['redis-readonly'] },
        groups: ['/redis-dev-access'],
      }

      jest.spyOn(keycloakAuthService, 'isKeycloakEnabled').mockReturnValue(true)
      jest
        .spyOn(keycloakAuthService, 'getStoredAccessToken')
        .mockReturnValue('valid.jwt.token')
      jest
        .spyOn(keycloakAuthService, 'parseJwtPayload')
        .mockReturnValue(mockPayload)

      // Act
      await store.dispatch<any>(initializeAppAction())

      // Assert
      const actions = store.getActions()
      expect(actions).toContainEqual(setKeycloakEnabled(true))
      expect(actions).toContainEqual(
        setKeycloakAuthenticated({
          sub: 'user-123',
          email: 'test@example.com',
          preferredUsername: 'testuser',
          roles: ['redis-readonly'],
          groups: ['/redis-dev-access'],
        }),
      )
    })

    it('clears stored tokens when the Keycloak token is expired', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      const mockPayload = {
        sub: 'user-123',
        exp: pastExp,
        realm_access: { roles: [] },
        groups: [],
      }

      jest.spyOn(keycloakAuthService, 'isKeycloakEnabled').mockReturnValue(true)
      jest
        .spyOn(keycloakAuthService, 'getStoredAccessToken')
        .mockReturnValue('expired.jwt.token')
      jest
        .spyOn(keycloakAuthService, 'parseJwtPayload')
        .mockReturnValue(mockPayload)
      const clearTokensSpy = jest
        .spyOn(keycloakAuthService, 'clearStoredTokens')
        .mockImplementation()

      // Act
      await store.dispatch<any>(initializeAppAction())

      // Assert
      expect(clearTokensSpy).toHaveBeenCalled()
      const actions = store.getActions()
      expect(actions).not.toContainEqual(
        expect.objectContaining({
          type: 'keycloakAuth/setKeycloakAuthenticated',
        }),
      )
    })

    it('clears stored tokens when parsing the Keycloak token fails', async () => {
      jest.spyOn(keycloakAuthService, 'isKeycloakEnabled').mockReturnValue(true)
      jest
        .spyOn(keycloakAuthService, 'getStoredAccessToken')
        .mockReturnValue('invalid.token')
      jest
        .spyOn(keycloakAuthService, 'parseJwtPayload')
        .mockImplementation(() => {
          throw new Error('parse error')
        })
      const clearTokensSpy = jest
        .spyOn(keycloakAuthService, 'clearStoredTokens')
        .mockImplementation()

      // Act
      await store.dispatch<any>(initializeAppAction())

      // Assert
      expect(clearTokensSpy).toHaveBeenCalled()
    })

    it('does not attempt token restoration when Keycloak is disabled', async () => {
      jest
        .spyOn(keycloakAuthService, 'isKeycloakEnabled')
        .mockReturnValue(false)
      const getStoredTokenSpy = jest.spyOn(
        keycloakAuthService,
        'getStoredAccessToken',
      )

      // Act
      await store.dispatch<any>(initializeAppAction())

      // Assert
      expect(getStoredTokenSpy).not.toHaveBeenCalled()
    })
  })
})
