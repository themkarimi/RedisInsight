import React, { useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import {
  exchangeCodeForTokens,
  parseJwtPayload,
  storeAccessToken,
} from 'uiSrc/services/keycloakAuthService'
import {
  setKeycloakAuthenticated,
  setKeycloakError,
} from 'uiSrc/slices/auth/keycloak'

/**
 * Handles the redirect from Keycloak after the Authorization Code Flow.
 * Exchanges the code for tokens, stores the access token, and navigates home.
 */
const KeycloakCallbackPage = () => {
  const history = useHistory()
  const dispatch = useDispatch()

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const savedState = sessionStorage.getItem('kc_state')

    if (!code) {
      dispatch(setKeycloakError('No authorization code received from Keycloak'))
      history.replace('/')
      return
    }

    if (state !== savedState) {
      dispatch(setKeycloakError('Invalid OAuth state parameter'))
      history.replace('/')
      return
    }

    exchangeCodeForTokens(code)
      .then((tokens) => {
        storeAccessToken(tokens.access_token)
        const payload = parseJwtPayload(tokens.access_token)
        const realmAccess = payload.realm_access as
          | { roles?: string[] }
          | undefined
        dispatch(
          setKeycloakAuthenticated({
            sub: payload.sub as string,
            email: payload.email as string | undefined,
            preferredUsername: payload.preferred_username as string | undefined,
            roles: realmAccess?.roles ?? [],
            groups: Array.isArray(payload.groups)
              ? (payload.groups as string[])
              : [],
          }),
        )
        history.replace('/')
      })
      .catch((err) => {
        dispatch(
          setKeycloakError(
            err instanceof Error ? err.message : 'Token exchange failed',
          ),
        )
        history.replace('/')
      })
  }, [dispatch, history])

  return <div data-testid="keycloak-callback-page">Authenticating…</div>
}

export default KeycloakCallbackPage
