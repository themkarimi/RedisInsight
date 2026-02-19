import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { KeycloakService, KeycloakTokenClaims } from './keycloak.service';

export const KEYCLOAK_CLAIMS_KEY = 'keycloakClaims';

@Injectable()
export class KeycloakJwtMiddleware implements NestMiddleware {
  private readonly logger = new Logger(KeycloakJwtMiddleware.name);

  constructor(private readonly keycloakService: KeycloakService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    let claims: KeycloakTokenClaims;
    try {
      claims = await this.keycloakService.validateToken(token);
    } catch (err) {
      this.logger.warn(`JWT validation failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Attach claims to request so downstream middleware / guards can use them
    (req as any)[KEYCLOAK_CLAIMS_KEY] = claims;
    next();
  }

  // eslint-disable-next-line class-methods-use-this
  private extractToken(req: Request): string | null {
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }
    // Also support httpOnly cookie named 'access_token'
    return (req.cookies as Record<string, string>)?.access_token ?? null;
  }
}
