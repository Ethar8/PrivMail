/**
 * End-to-end login flow. Requires a running stack (E2E_BASE_URL set). When the
 * environment variable is absent the suite is skipped so the default test run
 * stays green without external services.
 */
const BASE_URL = process.env.E2E_BASE_URL;
const maybe = BASE_URL ? describe : describe.skip;

maybe('E2E: login', () => {
  it('reports whether setup is required', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/setup-required`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('setupRequired');
  });
});

export {};
