import {
  ForbiddenException,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatabaseEntity } from 'src/modules/database/entities/database.entity';
import { KEYCLOAK_CLAIMS_KEY } from './keycloak-jwt.middleware';
import { KeycloakTokenClaims } from './keycloak.service';

@Injectable()
export class KeycloakRbacMiddleware implements NestMiddleware {
  private readonly logger = new Logger(KeycloakRbacMiddleware.name);

  constructor(
    @InjectRepository(DatabaseEntity)
    private readonly databaseRepository: Repository<DatabaseEntity>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const claims: KeycloakTokenClaims | undefined = (req as any)[
      KEYCLOAK_CLAIMS_KEY
    ];

    // JWT middleware has not populated claims — skip RBAC check
    if (!claims) {
      next();
      return;
    }

    const databaseId = this.extractDatabaseId(req);

    if (!databaseId) {
      // Request not scoped to a specific database — allow through
      next();
      return;
    }

    const database = await this.databaseRepository.findOne({
      where: { id: databaseId },
      select: ['id', 'allowedGroups', 'allowedRoles'] as any,
    });

    if (!database) {
      // Database not found — let the controller return a 404
      next();
      return;
    }

    const parseJsonArray = (raw: unknown): string[] => {
      if (Array.isArray(raw)) return raw as string[];
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const allowedGroups: string[] = parseJsonArray((database as any).allowedGroups);
    const allowedRoles: string[] = parseJsonArray((database as any).allowedRoles);

    // If no restrictions are configured, allow all authenticated users
    if (allowedGroups.length === 0 && allowedRoles.length === 0) {
      next();
      return;
    }

    const hasAccess =
      claims.groups.some((g) => allowedGroups.includes(g)) ||
      claims.roles.some((r) => allowedRoles.includes(r));

    if (!hasAccess) {
      this.logger.warn(
        `User ${claims.sub} denied access to database ${databaseId}`,
      );
      throw new ForbiddenException(
        'You do not have permission to access this Redis instance',
      );
    }

    next();
  }

  // eslint-disable-next-line class-methods-use-this
  private extractDatabaseId(req: Request): string | null {
    // Matches /databases/:id  and  /databases/:dbInstance/...
    const match =
      /\/databases\/([a-zA-Z0-9-]+)/.exec(req.path) ||
      /\/databases\/([a-zA-Z0-9-]+)/.exec(req.url);
    return match?.[1] ?? null;
  }
}
