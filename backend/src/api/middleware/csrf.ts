import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { config } from '../../config/config';
import { getCookie } from '../../utils/cookies';

// Manuelle CSRF-Schutz-Middleware (Punkt1)
// Generiert und validiert CSRF-Token, die in Cookies und Headers gespeichert werden

export function generateCsrfToken(): string {
  // Zufälliger 32-byte-Token, Base64url-kodiert
  return crypto.randomBytes(32).toString('base64url');
}

export function csrfMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // OIDC protocol endpoints (token, auth resume, etc.) are called by
    // Vaultwarden/Immich servers and browsers without our XSRF cookie.
    // node-oidc-provider has its own state/PKCE protections.
    if (
      req.path.startsWith('/oidc/') ||
      req.path === '/.well-known/openid-configuration' ||
      req.path === '/.well-known/oauth-authorization-server'
    ) {
      return next();
    }

    // GET/HEAD/OPTIONS Anfragen brauchen keinen CSRF-Schutz
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Neues Token generieren, wenn noch keins vorhanden ist
      const existingToken = getCookie(req.headers, 'XSRF-TOKEN');
      if (!existingToken) {
        const token = generateCsrfToken();
        res.cookie('XSRF-TOKEN', token, {
          httpOnly: false, // Client muss es auslesen können, um im Header zu senden
          secure: config.isProduction,
          sameSite: 'strict',
          path: '/',
          maxAge: 86400000 // 24 Stunden Gültigkeit
        });
      }
      return next();
    }

    // Für state-changing Requests (POST/PUT/DELETE) Token validieren
    const cookieToken = getCookie(req.headers, 'XSRF-TOKEN');
    const headerToken = req.headers['x-xsrf-token'];

    const headerValue = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (!cookieToken || !headerValue || cookieToken !== headerValue) {
      return res.status(403).json({ error: 'Ungültiges oder fehlendes CSRF-Token' });
    }

    next();
  };
}
