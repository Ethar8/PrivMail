import express, { Express } from 'express';
import 'express-async-errors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from './config/config';
import { getPool } from './database/connection';
import { corsMiddleware } from './api/middleware/cors';
import { requestLogger } from './api/middleware/logging';
import { requireHttps } from './api/middleware/https';
import { apiLimiter } from './api/middleware/rate-limit';
import { notFound, errorHandler } from './api/middleware/error-handler';
import { authRouter } from './api/routes/auth';
import { webauthnRouter } from './api/routes/webauthn';
import { mailRouter } from './api/routes/mail';
import { searchRouter } from './api/routes/search';
import { aiRouter } from './api/routes/ai';
import { adminRouter } from './api/routes/admin';
import { calendarRouter } from './api/routes/calendar';
import { contactsRouter } from './api/routes/contacts';
import { settingsRouter } from './api/routes/settings';

export function createApp(): Express {
  const app = express();

  // Behind the nginx reverse proxy: trust the first hop so req.secure and
  // req.ip reflect the real client via X-Forwarded-* headers.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // HSTS: force HTTPS for two years, include subdomains, allow preload.
      hsts: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );
  // Reject any plaintext request that slips past the proxy (production only).
  app.use(requireHttps);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '25mb' }));
  app.use(requestLogger);

  // Persistent session store (Postgres) so WebAuthn challenges and sessions
  // survive restarts and work across multiple processes. Falls back to the
  // in-memory store only when no database is configured (e.g. some tests).
  const PgStore = connectPgSimple(session);
  const sessionStore = config.databaseUrl
    ? new PgStore({ pool: getPool(), tableName: 'user_sessions', createTableIfMissing: true })
    : undefined;

  app.use(
    session({
      store: sessionStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: config.isProduction, sameSite: 'lax' },
    }),
  );
  app.use('/api', apiLimiter);

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'privmail-backend' }));

  app.use('/api/auth/webauthn', webauthnRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/mail', mailRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/settings', settingsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
