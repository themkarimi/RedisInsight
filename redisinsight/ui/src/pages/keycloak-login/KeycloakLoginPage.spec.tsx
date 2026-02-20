import { cloneDeep, set } from 'lodash'
import React from 'react'
import {
  cleanup,
  mockedStore,
  render,
  initialStateDefault,
  mockStore,
  fireEvent,
} from 'uiSrc/utils/test-utils'
import * as keycloakAuthService from 'uiSrc/services/keycloakAuthService'
import KeycloakLoginPage from './KeycloakLoginPage'

jest.mock('uiSrc/services/keycloakAuthService', () => ({
  ...jest.requireActual('uiSrc/services/keycloakAuthService'),
  redirectToKeycloakLogin: jest.fn(),
}))

const mockStoreWithKeycloak = (overrides: Record<string, unknown> = {}) => {
  const state = cloneDeep(initialStateDefault)
  set(state, 'keycloakAuth.isEnabled', true)
  set(state, 'keycloakAuth.isAuthenticated', false)
  Object.entries(overrides).forEach(([key, value]) => {
    set(state, key, value)
  })
  return mockStore(state)
}

describe('KeycloakLoginPage', () => {
  let store: typeof mockedStore

  beforeEach(() => {
    cleanup()
    store = mockStoreWithKeycloak()
    jest.clearAllMocks()
  })

  it('should render the login page', () => {
    const { getByTestId } = render(<KeycloakLoginPage />, { store })
    expect(getByTestId('keycloak-login-page')).toBeInTheDocument()
  })

  it('should render the sign-in button', () => {
    const { getByTestId } = render(<KeycloakLoginPage />, { store })
    expect(getByTestId('keycloak-login-btn')).toBeInTheDocument()
  })

  it('should call redirectToKeycloakLogin when sign-in button is clicked', () => {
    const { getByTestId } = render(<KeycloakLoginPage />, { store })
    fireEvent.click(getByTestId('keycloak-login-btn'))
    expect(keycloakAuthService.redirectToKeycloakLogin).toHaveBeenCalled()
  })

  it('should display error message when error exists', () => {
    store = mockStoreWithKeycloak({
      'keycloakAuth.error': 'Authentication failed',
    })
    const { getByTestId } = render(<KeycloakLoginPage />, { store })
    expect(getByTestId('keycloak-login-error')).toHaveTextContent(
      'Authentication failed',
    )
  })

  it('should not display error when no error exists', () => {
    const { queryByTestId } = render(<KeycloakLoginPage />, { store })
    expect(queryByTestId('keycloak-login-error')).not.toBeInTheDocument()
  })
})
