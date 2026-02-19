import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { KeycloakConfig } from './keycloak.config';

export interface KeycloakTokenClaims {
  sub: string;
  email?: string;
  preferred_username?: string;
  /** Realm-level roles from realm_access.roles */
  roles: string[];
  /** Groups from the 'groups' claim */
  groups: string[];
  [key: string]: unknown;
}

interface JwksKey {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n?: string;
  e?: string;
  x5c?: string[];
}

interface JwksResponse {
  keys: JwksKey[];
}

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);

  private jwksCache: Map<string, crypto.KeyObject> = new Map();

  private jwksCacheTimestamp = 0;

  constructor(private readonly config: KeycloakConfig) {}

  /**
   * Validates a Bearer JWT token and returns the decoded claims.
   * Throws if the token is missing, expired or has an invalid signature.
   */
  async validateToken(token: string): Promise<KeycloakTokenClaims> {
    const publicKey = await this.getSigningKey(token);

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
      issuer: `${this.config.url}/realms/${this.config.realm}`,
    }) as jwt.JwtPayload;

    return this.extractClaims(decoded);
  }

  private extractClaims(payload: jwt.JwtPayload): KeycloakTokenClaims {
    const roles: string[] =
      (payload.realm_access as { roles?: string[] })?.roles ?? [];
    const groups: string[] = Array.isArray(payload.groups)
      ? (payload.groups as string[])
      : [];

    return {
      ...payload,
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      preferred_username: payload.preferred_username as string | undefined,
      roles,
      groups,
    };
  }

  private async getSigningKey(token: string): Promise<crypto.KeyObject> {
    const header = this.decodeHeader(token);
    const kid: string = header?.kid ?? '';

    // Try cache first
    const now = Date.now();
    if (
      this.jwksCache.has(kid) &&
      now - this.jwksCacheTimestamp < JWKS_CACHE_TTL_MS
    ) {
      return this.jwksCache.get(kid) as crypto.KeyObject;
    }

    await this.refreshJwksCache();

    const key = this.jwksCache.get(kid);
    if (!key) {
      throw new Error(`No JWKS key found for kid: ${kid}`);
    }
    return key;
  }

  private async refreshJwksCache(): Promise<void> {
    this.logger.log(`Fetching JWKS from ${this.config.jwksUrl}`);
    const response = await axios.get<JwksResponse>(this.config.jwksUrl, {
      timeout: 5000,
    });

    this.jwksCache.clear();
    for (const key of response.data.keys) {
      if (key.kty === 'RSA' && key.n && key.e) {
        const keyObject = crypto.createPublicKey({
          key: { kty: key.kty, n: key.n, e: key.e },
          format: 'jwk',
        });
        this.jwksCache.set(key.kid, keyObject);
      }
    }
    this.jwksCacheTimestamp = Date.now();
  }

  // eslint-disable-next-line class-methods-use-this
  private decodeHeader(token: string): Record<string, unknown> | null {
    try {
      const [headerB64] = token.split('.');
      return JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  }
}
