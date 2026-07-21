import { aiAdminApi } from '@/lib/ai-admin-api';

describe('aiAdminApi', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, model: 'llama3', endpoint: 'http://x', sensitivity: 50, timeoutMs: 5000 }),
    }) as unknown as typeof fetch;
  });

  it('get/set/status hit admin endpoints', async () => {
    await aiAdminApi.get();
    await aiAdminApi.set({ enabled: false });
    await aiAdminApi.status();
    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes('/admin/ai-config'))).toBe(true);
    expect(urls.some((u) => u.includes('/admin/status'))).toBe(true);
  });
});
