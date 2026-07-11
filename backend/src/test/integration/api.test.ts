import request from 'supertest';
import { createApp } from '../../app';

/**
 * API smoke tests that do not require a database connection. Endpoints that
 * touch the DB are covered by the DB-backed integration suite (mail-flow),
 * which runs in CI with a Postgres service container.
 */
describe('API (no DB required)', () => {
  const app = createApp();

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('unknown route returns 404 JSON', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('GET /api/search/info documents client-side search', async () => {
    // requireAuth protects it -> expect 401 without token
    const res = await request(app).get('/api/search/info');
    expect(res.status).toBe(401);
  });

  it('GET /api/ai/providers requires auth', async () => {
    const res = await request(app).get('/api/ai/providers');
    expect(res.status).toBe(401);
  });
});
