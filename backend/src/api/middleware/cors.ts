import cors from 'cors';
import { config } from '../../config/config';

const allowlist = config.corsOrigins as readonly string[];

/**
 * CORS with an explicit origin whitelist from CORS_ORIGINS. Requests without an
 * Origin header (same-origin, curl, server-to-server) are always allowed. In
 * development with no whitelist configured, any origin is reflected for
 * convenience; in production a non-empty whitelist should be set.
 */
export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowlist.length === 0) {
      // No whitelist configured: permissive only outside production.
      return callback(null, !config.isProduction);
    }
    return callback(null, allowlist.includes(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
