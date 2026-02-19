# Keycloak OIDC Authentication & RBAC

This document explains how to configure Keycloak-based authentication and
role-based access control (RBAC) for Redis instances in RedisInsight.

---

## Overview

When the Keycloak environment variables below are set, RedisInsight:

1. **Backend** validates every API request by verifying the Bearer JWT token
   against Keycloak's public JWKS endpoint.
2. **Backend** enforces per-instance RBAC: each Redis instance can declare
   `allowedGroups` and `allowedRoles`. Only users whose Keycloak groups or
   realm roles match are granted access.
3. **Frontend** attaches the stored access token to every API call and redirects
   to the Keycloak login page on a `401 Unauthorized` response.

---

## Environment Variables (Backend)

| Variable | Required | Description |
|---|---|---|
| `KEYCLOAK_URL` | ✅ | Base URL of your Keycloak server, e.g. `https://auth.example.com` |
| `KEYCLOAK_REALM` | ✅ | Realm name, e.g. `myrealm` |
| `KEYCLOAK_CLIENT_ID` | ✅ | Client ID registered in Keycloak, e.g. `redis-insight` |
| `KEYCLOAK_CLIENT_SECRET` | ❌ | Client secret (only for confidential clients) |
| `KEYCLOAK_JWKS_URL` | ❌ | Override JWKS URL. Defaults to `{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs` |

When none of these variables are set, Keycloak authentication is **disabled**
and the application behaves exactly as before.

---

## Frontend Variables (Vite build or server-injected globals)

The frontend reads Keycloak configuration from either Vite env vars or
server-injected `window` globals.

| Variable | `window` global | Description |
|---|---|---|
| `VITE_KEYCLOAK_URL` | `window.__RI_KEYCLOAK_URL__` | Keycloak URL |
| `VITE_KEYCLOAK_REALM` | `window.__RI_KEYCLOAK_REALM__` | Realm name |
| `VITE_KEYCLOAK_CLIENT_ID` | `window.__RI_KEYCLOAK_CLIENT_ID__` | Client ID |

---

## Keycloak Client Configuration

1. Create a new **OpenID Connect** client in your Keycloak realm.
2. Set **Client authentication** to `OFF` (public client — uses PKCE).
3. Add your RedisInsight URL to **Valid redirect URIs**:
   ```
   https://your-redis-insight.example.com/keycloak-callback
   ```
4. Add your domain to **Web origins** (for CORS):
   ```
   https://your-redis-insight.example.com
   ```

---

## Role & Group Mapping

### Realm Roles

Create realm roles in Keycloak such as:
- `redis-admin`
- `redis-readonly`

Assign these roles to users or groups.

### Groups

Create groups such as:
- `/redis-prod-access`
- `/redis-dev-access`

Ensure the `groups` claim is included in the access token by adding a
**Group Membership** mapper to the client's dedicated scopes.

---

## Protecting a Redis Instance

When creating or updating a Redis database instance, set the `allowedGroups`
and `allowedRoles` fields:

```json
{
  "name": "Production Redis",
  "host": "redis.prod.example.com",
  "port": 6379,
  "allowedGroups": ["/redis-prod-access"],
  "allowedRoles": ["redis-admin"]
}
```

- A user is granted access if **at least one** of their groups or roles matches.
- If both arrays are empty, **all authenticated users** may access the instance.

---

## How It Works

### Authorization Code Flow with PKCE

1. User visits RedisInsight.
2. On a `401` API response the frontend calls `redirectToKeycloakLogin()`.
3. User authenticates in Keycloak and is redirected to `/keycloak-callback`.
4. The callback page exchanges the authorization code for tokens using PKCE.
5. The access token is stored in `sessionStorage`.
6. All subsequent API requests include `Authorization: Bearer <token>`.

### JWT Validation (Backend)

1. `KeycloakJwtMiddleware` extracts the Bearer token from the
   `Authorization` header (or the `access_token` httpOnly cookie).
2. `KeycloakService` fetches Keycloak's JWKS endpoint (cached for 5 minutes)
   and verifies the token signature, issuer and expiry.
3. The decoded claims (sub, email, roles, groups) are attached to `req`.

### RBAC Enforcement (Backend)

`KeycloakRbacMiddleware` runs after JWT validation:
1. Extracts the database ID from the request URL.
2. Loads `allowedGroups` and `allowedRoles` from the database record.
3. Compares them against the user's claims.
4. Returns `403 Forbidden` if no match is found.

---

## Audit Logging

Set your logger level to `debug` to see access-denied log entries:

```
WARN KeycloakRbacMiddleware - User abc-123 denied access to database xyz-456
```
