import express, { Express } from 'express';
import 'express-async-errors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from './config/config';
import { getPool } from './database/connection';
import { corsMiddleware } from './api/middleware/cors';
import { csrfMiddleware } from './api/middleware/csrf';
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
import { aliasRouter } from './api/routes/aliases';
import { externalRouter } from './api/routes/external';
import { filterRouter } from './api/routes/filters';
import { autoresponderRouter } from './api/routes/autoresponder';
import { setupWizardRouter } from './api/routes/setup-wizard';
import { importRouter } from './api/routes/import';
import { attachmentShareRouter } from './api/routes/attachment-shares';
import { oidcInteractionRouter } from './api/routes/oidc-interaction';
import { oidcClientsRouter } from './api/routes/oidc-clients';
import { startCleanupJobs } from './services/cleanup';
import { logger } from './utils/logger';

export async function createApp(): Promise<Express> {
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
      // OIDC discovery + JWKS are public JSON; relax CORP slightly for IdP endpoints.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  // Reject any plaintext request that slips past the proxy (production only).
  app.use(requireHttps);
  app.use(corsMiddleware);

  // OIDC must be mounted BEFORE express.json() — node-oidc-provider parses
  // application/x-www-form-urlencoded token requests itself.
  if (config.databaseUrl) {
    try {
      const { getOidcProvider, initOidcProvider, mountOidcProvider } = await import(
        './services/oidc-provider'
      );
      let provider;
      try {
        provider = getOidcProvider();
      } catch {
        provider = await initOidcProvider();
      }
      mountOidcProvider(app, provider);
    } catch (err) {
      if (config.isProduction) {
        logger.error('OIDC provider failed to start', (err as Error).message);
        throw err;
      }
      logger.warn(`OIDC provider unavailable: ${(err as Error).message}`);
    }
  } else {
    logger.warn('DATABASE_URL unset — OIDC Identity Provider not started');
  }

  app.use(express.json({ limit: '25mb' }));
  app.use(csrfMiddleware());
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
      cookie: { httpOnly: true, secure: config.isProduction, sameSite: 'strict' },
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
  app.use('/api/admin/oidc-clients', oidcClientsRouter);
  app.use('/api/oidc/interaction', oidcInteractionRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/aliases', aliasRouter);
  app.use('/api/external', externalRouter);
  app.use('/api/filters', filterRouter);
  app.use('/api/autoresponder', autoresponderRouter);
  app.use('/api/setup-wizard', setupWizardRouter);
  app.use('/api/import', importRouter);
  app.use('/api/attachment-shares', attachmentShareRouter);

  app.use(notFound);
  app.use(errorHandler);

  startCleanupJobs();

  return app;
}
