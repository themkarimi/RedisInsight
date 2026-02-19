import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseEntity } from 'src/modules/database/entities/database.entity';
import { getKeycloakConfig, KeycloakConfig } from './keycloak.config';
import { KeycloakService } from './keycloak.service';
import { KeycloakJwtMiddleware } from './keycloak-jwt.middleware';
import { KeycloakRbacMiddleware } from './keycloak-rbac.middleware';

export const KEYCLOAK_CONFIG = 'KEYCLOAK_CONFIG';

@Module({})
export class KeycloakModule implements NestModule {
  /**
   * Returns a DynamicModule only when all required Keycloak environment
   * variables are present. When Keycloak is not configured the method returns
   * an empty module so the rest of the application works unchanged.
   */
  static register(): DynamicModule {
    const config: KeycloakConfig | null = getKeycloakConfig();

    if (!config) {
      return { module: KeycloakModule };
    }

    return {
      module: KeycloakModule,
      imports: [TypeOrmModule.forFeature([DatabaseEntity])],
      providers: [
        { provide: KEYCLOAK_CONFIG, useValue: config },
        {
          provide: KeycloakService,
          useFactory: (cfg: KeycloakConfig) => new KeycloakService(cfg),
          inject: [KEYCLOAK_CONFIG],
        },
        KeycloakJwtMiddleware,
        KeycloakRbacMiddleware,
      ],
      exports: [KeycloakService],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    const config = getKeycloakConfig();

    if (!config) {
      return;
    }

    consumer.apply(KeycloakJwtMiddleware).forRoutes('*');
    consumer.apply(KeycloakRbacMiddleware).forRoutes('*');
  }
}
