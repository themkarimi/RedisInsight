/**
 * Keycloak OIDC configuration loaded from environment variables.
 */
export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
  clientSecret?: string;
  jwksUrl: string;
}

/**
 * Reads Keycloak configuration from process environment.
 * Returns null when required variables are absent (feature disabled).
 */
export function getKeycloakConfig(): KeycloakConfig | null {
  const { KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID } = process.env;

  if (!KEYCLOAK_URL || !KEYCLOAK_REALM || !KEYCLOAK_CLIENT_ID) {
    return null;
  }

  const jwksUrl =
    process.env.KEYCLOAK_JWKS_URL ||
    `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`;

  return {
    url: KEYCLOAK_URL,
    realm: KEYCLOAK_REALM,
    clientId: KEYCLOAK_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    jwksUrl,
  };
}
