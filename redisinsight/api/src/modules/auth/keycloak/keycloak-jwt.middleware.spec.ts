import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { KeycloakJwtMiddleware, KEYCLOAK_CLAIMS_KEY } from './keycloak-jwt.middleware';
import { KeycloakService, KeycloakTokenClaims } from './keycloak.service';
import { KeycloakConfig } from './keycloak.config';

const mockClaims: KeycloakTokenClaims = {
  sub: 'user-123',
  email: 'test@example.com',
  roles: ['redis-readonly'],
  groups: ['/redis-dev-access'],
};

const mockKeycloakService = {
  validateToken: jest.fn(),
};

describe('KeycloakJwtMiddleware', () => {
  let middleware: KeycloakJwtMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakJwtMiddleware,
        { provide: KeycloakService, useValue: mockKeycloakService },
      ],
    }).compile();

    middleware = module.get<KeycloakJwtMiddleware>(KeycloakJwtMiddleware);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const makeReq = (authHeader?: string, cookie?: string) =>
    ({
      headers: { authorization: authHeader },
      cookies: cookie ? { access_token: cookie } : {},
    } as unknown as Request);

  it('should attach claims to request when token is valid', async () => {
    mockKeycloakService.validateToken.mockResolvedValue(mockClaims);
    const req = makeReq('Bearer valid-token') as any;
    const next = jest.fn();

    await middleware.use(req, {} as Response, next);

    expect(req[KEYCLOAK_CLAIMS_KEY]).toEqual(mockClaims);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should throw UnauthorizedException when no token is present', async () => {
    const req = makeReq() as any;

    await expect(
      middleware.use(req, {} as Response, jest.fn()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should throw UnauthorizedException when validateToken throws', async () => {
    mockKeycloakService.validateToken.mockRejectedValue(
      new Error('invalid signature'),
    );
    const req = makeReq('Bearer bad-token') as any;

    await expect(
      middleware.use(req, {} as Response, jest.fn()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should read token from cookie when Authorization header is absent', async () => {
    mockKeycloakService.validateToken.mockResolvedValue(mockClaims);
    const req = makeReq(undefined, 'cookie-token') as any;
    const next = jest.fn();

    await middleware.use(req, {} as Response, next);

    expect(mockKeycloakService.validateToken).toHaveBeenCalledWith(
      'cookie-token',
    );
    expect(next).toHaveBeenCalled();
  });
});
