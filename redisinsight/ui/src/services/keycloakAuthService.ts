/**
 * Keycloak OIDC authentication service.
 *
 * Implements the Authorization Code Flow with PKCE for browser clients.
 * Configuration is expected via the global `window.__RI_KEYCLOAK_*` variables
 * (injected by the server) or via build-time environment variables.
 */

export interface KeycloakClientConfig {
  url: string
  realm: string
  clientId: string
}

const getConfig = (): KeycloakClientConfig | null => {
  const win = window as any
  const url = win.__RI_KEYCLOAK_URL__ || process.env.VITE_KEYCLOAK_URL
  const realm = win.__RI_KEYCLOAK_REALM__ || process.env.VITE_KEYCLOAK_REALM
  const clientId =
    win.__RI_KEYCLOAK_CLIENT_ID__ || process.env.VITE_KEYCLOAK_CLIENT_ID

  if (!url || !realm || !clientId) {
    return null
  }

  return { url, realm, clientId }
}

export const isKeycloakEnabled = (): boolean => !!getConfig()

const buildAuthorizeUrl = (
  cfg: KeycloakClientConfig,
  codeChallenge: string,
  state: string,
): string => {
  const redirectUri = `${window.location.origin}/keycloak-callback`
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })
  return `${cfg.url}/realms/${cfg.realm}/protocol/openid-connect/auth?${params.toString()}`
}

const generateCodeVerifier = (): string => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/** Redirects the browser to the Keycloak login page. */
export const redirectToKeycloakLogin = async (): Promise<void> => {
  const cfg = getConfig()
  if (!cfg) return

  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = crypto.randomUUID()

  sessionStorage.setItem('kc_code_verifier', verifier)
  sessionStorage.setItem('kc_state', state)

  window.location.href = buildAuthorizeUrl(cfg, challenge, state)
}

export interface KeycloakTokenResponse {
  access_token: string
  refresh_token: string
  id_token: string
  expires_in: number
}

/** Exchanges the authorization code for tokens. */
export const exchangeCodeForTokens = async (
  code: string,
): Promise<KeycloakTokenResponse> => {
  const cfg = getConfig()
  if (!cfg) throw new Error('Keycloak is not configured')

  const verifier = sessionStorage.getItem('kc_code_verifier') ?? ''
  const redirectUri = `${window.location.origin}/keycloak-callback`

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: cfg.clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  })

  const response = await fetch(
    `${cfg.url}/realms/${cfg.realm}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  )

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`)
  }

  return response.json() as Promise<KeycloakTokenResponse>
}

/** Parses the JWT payload without verifying the signature (client-side only). */
export const parseJwtPayload = (token: string): Record<string, unknown> => {
  const [, payloadB64] = token.split('.')
  return JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
}

/** Stores the access token so axios can attach it to requests. */
export const storeAccessToken = (token: string): void => {
  sessionStorage.setItem('kc_access_token', token)
}

export const getStoredAccessToken = (): string | null =>
  sessionStorage.getItem('kc_access_token')

export const clearStoredTokens = (): void => {
  sessionStorage.removeItem('kc_access_token')
  sessionStorage.removeItem('kc_code_verifier')
  sessionStorage.removeItem('kc_state')
}

/** Redirects to the Keycloak logout endpoint and clears stored tokens. */
export const logoutFromKeycloak = (): void => {
  const cfg = getConfig()
  clearStoredTokens()

  if (!cfg) {
    window.location.href = '/'
    return
  }

  const redirectUri = encodeURIComponent(window.location.origin)
  window.location.href = `${cfg.url}/realms/${cfg.realm}/protocol/openid-connect/logout?redirect_uri=${redirectUri}`
}
