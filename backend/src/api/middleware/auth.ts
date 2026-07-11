import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';
import { JWT_EXPIRY, JWT_ALGORITHM } from '../../config/constants';
import { getTokenVersion } from '../../models/user';

export interface AuthedRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

export interface JwtPayload {
  userId: string;
  isAdmin: boolean;
  /** Token version — must match the user's current version or the token is revoked. */
  tv: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: JWT_EXPIRY,
    algorithm: JWT_ALGORITHM,
  });
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    // Regel 2 – Algorithmus hart erzwingen (verhindert alg:none / Key-Confusion).
    const payload = jwt.verify(header.slice(7), config.jwtSecret, {
      algorithms: [JWT_ALGORITHM],
    }) as JwtPayload;

    // Regel 1 – Token-Widerruf: die im Token eingebettete Version muss der
    // aktuellen DB-Version entsprechen. Nach Logout/Passwortwechsel wird die
    // Version erhöht und alle alten Tokens sind sofort ungültig.
    const currentVersion = await getTokenVersion(payload.userId);
    if (currentVersion === null || currentVersion !== payload.tv) {
      res.status(401).json({ error: 'Token revoked' });
      return;
    }

    req.userId = payload.userId;
    req.isAdmin = payload.isAdmin;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
