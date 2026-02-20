import { NestMiddleware, Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { trim } from 'lodash';
import * as fs from 'fs';
import { getKeycloakConfig } from 'src/modules/auth/keycloak/keycloak.config';

@Injectable()
export default class SubpathProxyMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const originalSendFile = res.sendFile;
    const proxyPath = trim(process.env.RI_PROXY_PATH, '/');
    const keycloakConfig = getKeycloakConfig();
    res.sendFile = function (
      this: Response,
      path: string,
      options: any,
      callback?: (err?: Error) => void,
    ) {
      if (path.endsWith('.html') || path.endsWith('.js')) {
        let content = fs.readFileSync(path, 'utf8');
        const regex = /\/?__RIPROXYPATH__/g;

        // for vite build proxyPath if exists should starts with '/'
        content = content.replace(regex, proxyPath ? '/' + proxyPath : '');

        // Inject Keycloak OIDC config so the frontend can enforce authentication
        if (keycloakConfig) {
          content = content.replace(/__RI_KEYCLOAK_URL__/g, keycloakConfig.url);
          content = content.replace(/__RI_KEYCLOAK_REALM__/g, keycloakConfig.realm);
          content = content.replace(/__RI_KEYCLOAK_CLIENT_ID__/g, keycloakConfig.clientId);
        }

        res.send(content);
        return;
      }
      originalSendFile.call(this, path, options, callback);
    };

    next();
  }
}
