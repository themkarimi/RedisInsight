import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { DatabaseEntity } from 'src/modules/database/entities/database.entity';
import { KeycloakRbacMiddleware } from './keycloak-rbac.middleware';
import { KEYCLOAK_CLAIMS_KEY } from './keycloak-jwt.middleware';
import { KeycloakTokenClaims } from './keycloak.service';

const mockDatabaseRepository = {
  findOne: jest.fn(),
};

const makeReq = (
  claims?: KeycloakTokenClaims,
  path = '/databases/db-id-123',
) => {
  const req = {
    path,
    url: path,
    [KEYCLOAK_CLAIMS_KEY]: claims,
  } as unknown as Request;
  return req;
};

describe('KeycloakRbacMiddleware', () => {
  let middleware: KeycloakRbacMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakRbacMiddleware,
        {
          provide: getRepositoryToken(DatabaseEntity),
          useValue: mockDatabaseRepository,
        },
      ],
    }).compile();

    middleware = module.get<KeycloakRbacMiddleware>(KeycloakRbacMiddleware);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should allow access when database has no restrictions', async () => {
    mockDatabaseRepository.findOne.mockResolvedValue({
      id: 'db-id-123',
      allowedGroups: [],
      allowedRoles: [],
    });

    const claims: KeycloakTokenClaims = {
      sub: 'user',
      roles: [],
      groups: [],
    };

    const next = jest.fn();
    await middleware.use(makeReq(claims), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should allow access when user role matches allowedRoles', async () => {
    mockDatabaseRepository.findOne.mockResolvedValue({
      id: 'db-id-123',
      allowedGroups: [],
      allowedRoles: ['redis-admin'],
    });

    const claims: KeycloakTokenClaims = {
      sub: 'user',
      roles: ['redis-admin'],
      groups: [],
    };

    const next = jest.fn();
    await middleware.use(makeReq(claims), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should allow access when user group matches allowedGroups', async () => {
    mockDatabaseRepository.findOne.mockResolvedValue({
      id: 'db-id-123',
      allowedGroups: ['/redis-prod-access'],
      allowedRoles: [],
    });

    const claims: KeycloakTokenClaims = {
      sub: 'user',
      roles: [],
      groups: ['/redis-prod-access'],
    };

    const next = jest.fn();
    await middleware.use(makeReq(claims), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should throw ForbiddenException when user has no matching role or group', async () => {
    mockDatabaseRepository.findOne.mockResolvedValue({
      id: 'db-id-123',
      allowedGroups: ['/redis-prod-access'],
      allowedRoles: ['redis-admin'],
    });

    const claims: KeycloakTokenClaims = {
      sub: 'user',
      roles: ['redis-readonly'],
      groups: ['/redis-dev-access'],
    };

    await expect(
      middleware.use(makeReq(claims), {} as Response, jest.fn()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should call next without checking when no claims are present', async () => {
    const next = jest.fn();
    await middleware.use(makeReq(undefined), {} as Response, next);

    expect(mockDatabaseRepository.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should call next when request path has no database id', async () => {
    const claims: KeycloakTokenClaims = {
      sub: 'user',
      roles: [],
      groups: [],
    };

    const next = jest.fn();
    await middleware.use(makeReq(claims, '/settings'), {} as Response, next);

    expect(mockDatabaseRepository.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
