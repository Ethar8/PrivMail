import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

export const searchRouter = Router();

searchRouter.use(requireAuth);

/**
 * PrivMail performs full-text search entirely client-side against the local
 * SQLite (FTS5) database so that the server never sees the search query. This
 * endpoint only documents that contract; it intentionally does not accept or
 * process any query text.
 */
searchRouter.get('/info', (_req, res) => {
  res.json({
    clientSide: true,
    engine: 'sqlite-fts5',
    note: 'Search runs locally in the browser; the server never receives the query.',
  });
});
