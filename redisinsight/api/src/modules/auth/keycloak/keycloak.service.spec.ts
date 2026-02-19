import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { KeycloakService } from './keycloak.service';
import { KeycloakConfig } from './keycloak.config';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const TEST_CONFIG: KeycloakConfig = {
  url: 'https://keycloak.example.com',
  realm: 'myrealm',
  clientId: 'redis-insight',
  jwksUrl: 'https://keycloak.example.com/realms/myrealm/protocol/openid-connect/certs',
};

const generateRsaKeyPair = () => {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
};

describe('KeycloakService', () => {
  let service: KeycloakService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: KeycloakService,
          useFactory: () => new KeycloakService(TEST_CONFIG),
        },
      ],
    }).compile();

    service = module.get<KeycloakService>(KeycloakService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateToken', () => {
    it('should validate a correctly signed token and return claims', async () => {
      const { privateKey, publicKey } = generateRsaKeyPair();
      const publicKeyJwk = publicKey.export({ format: 'jwk' }) as any;
      const kid = 'test-key-id';

      // Mock JWKS endpoint response
      mockedAxios.get = jest.fn().mockResolvedValue({
        data: {
          keys: [
            {
              kid,
              kty: 'RSA',
              alg: 'RS256',
              use: 'sig',
              n: publicKeyJwk.n,
              e: publicKeyJwk.e,
            },
          ],
        },
      });

      const payload = {
        sub: 'user-123',
        email: 'user@example.com',
        preferred_username: 'user123',
        realm_access: { roles: ['redis-readonly'] },
        groups: ['/redis-dev-access'],
        iss: `${TEST_CONFIG.url}/realms/${TEST_CONFIG.realm}`,
        exp: Math.trunc(Date.now() / 1000) + 3600,
        iat: Math.trunc(Date.now() / 1000),
      };

      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        keyid: kid,
        noTimestamp: true,
      });

      const claims = await service.validateToken(token);

      expect(claims.sub).toBe('user-123');
      expect(claims.email).toBe('user@example.com');
      expect(claims.roles).toEqual(['redis-readonly']);
      expect(claims.groups).toEqual(['/redis-dev-access']);
    });

    it('should throw when the JWKS has no matching kid', async () => {
      const { publicKey } = generateRsaKeyPair();
      const publicKeyJwk = publicKey.export({ format: 'jwk' }) as any;

      mockedAxios.get = jest.fn().mockResolvedValue({
        data: {
          keys: [
            {
              kid: 'different-kid',
              kty: 'RSA',
              n: publicKeyJwk.n,
              e: publicKeyJwk.e,
            },
          ],
        },
      });

      const { privateKey } = generateRsaKeyPair();
      const token = jwt.sign({ sub: 'x' }, privateKey, {
        algorithm: 'RS256',
        keyid: 'unknown-kid',
      });

      await expect(service.validateToken(token)).rejects.toThrow();
    });

    it('should throw for an expired token', async () => {
      const { privateKey, publicKey } = generateRsaKeyPair();
      const publicKeyJwk = publicKey.export({ format: 'jwk' }) as any;
      const kid = 'exp-kid';

      mockedAxios.get = jest.fn().mockResolvedValue({
        data: {
          keys: [
            {
              kid,
              kty: 'RSA',
              n: publicKeyJwk.n,
              e: publicKeyJwk.e,
            },
          ],
        },
      });

      const expiredToken = jwt.sign(
        {
          sub: 'user',
          iss: `${TEST_CONFIG.url}/realms/${TEST_CONFIG.realm}`,
          exp: Math.trunc(Date.now() / 1000) - 3600,
          iat: Math.trunc(Date.now() / 1000) - 7200,
        },
        privateKey,
        { algorithm: 'RS256', keyid: kid, noTimestamp: true },
      );

      await expect(service.validateToken(expiredToken)).rejects.toThrow();
    });
  });
});
