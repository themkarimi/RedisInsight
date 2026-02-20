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
import { SideBar } from 'uiSrc/components/base/layout/sidebar'
import * as keycloakAuthService from 'uiSrc/services/keycloakAuthService'
import KeycloakUserMenu from './KeycloakUserMenu'

jest.mock('uiSrc/services/keycloakAuthService', () => ({
  ...jest.requireActual('uiSrc/services/keycloakAuthService'),
  logoutFromKeycloak: jest.fn(),
}))

const mockUser = {
  sub: 'user-123',
  email: 'user@example.com',
  preferredUsername: 'testuser',
  roles: ['admin'],
  groups: ['/team-a'],
}

const mockStoreWithKeycloak = (overrides: Record<string, unknown> = {}) => {
  const state = cloneDeep(initialStateDefault)
  set(state, 'keycloakAuth.isEnabled', true)
  set(state, 'keycloakAuth.isAuthenticated', true)
  set(state, 'keycloakAuth.user', mockUser)
  Object.entries(overrides).forEach(([key, value]) => {
    set(state, key, value)
  })
  return mockStore(state)
}

const renderInSideBar = (store: typeof mockedStore) =>
  render(
    <SideBar isExpanded={false}>
      <KeycloakUserMenu />
    </SideBar>,
    { store },
  )

describe('KeycloakUserMenu', () => {
  let store: typeof mockedStore

  beforeEach(() => {
    cleanup()
    store = mockStoreWithKeycloak()
    jest.clearAllMocks()
  })

  it('should render the user menu button', () => {
    const { getByTestId } = renderInSideBar(store)
    expect(getByTestId('keycloak-user-menu-button')).toBeInTheDocument()
  })

  it('should show user info when menu is opened', () => {
    const { getByTestId } = renderInSideBar(store)
    fireEvent.click(getByTestId('keycloak-user-menu-button'))
    expect(getByTestId('keycloak-user-menu')).toBeInTheDocument()
    expect(getByTestId('keycloak-user-name')).toHaveTextContent('testuser')
  })

  it('should show email when it differs from display name', () => {
    const { getByTestId } = renderInSideBar(store)
    fireEvent.click(getByTestId('keycloak-user-menu-button'))
    expect(getByTestId('keycloak-user-email')).toHaveTextContent(
      'user@example.com',
    )
  })

  it('should not show email separately when it matches display name', () => {
    store = mockStoreWithKeycloak({
      'keycloakAuth.user': {
        ...mockUser,
        preferredUsername: undefined,
        email: 'user@example.com',
      },
    })
    const { getByTestId, queryByTestId } = renderInSideBar(store)
    fireEvent.click(getByTestId('keycloak-user-menu-button'))
    expect(getByTestId('keycloak-user-name')).toHaveTextContent(
      'user@example.com',
    )
    expect(queryByTestId('keycloak-user-email')).not.toBeInTheDocument()
  })

  it('should render sign out button and call logoutFromKeycloak on click', () => {
    const { getByTestId } = renderInSideBar(store)
    fireEvent.click(getByTestId('keycloak-user-menu-button'))
    const logoutBtn = getByTestId('keycloak-logout-btn')
    expect(logoutBtn).toBeInTheDocument()
    fireEvent.click(logoutBtn)
    expect(keycloakAuthService.logoutFromKeycloak).toHaveBeenCalled()
  })
})
