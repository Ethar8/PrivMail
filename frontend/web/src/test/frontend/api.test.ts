import { getToken, clearToken, setToken } from '../../lib/api';

describe('api token helpers', () => {
  it('uses cookie-managed auth', () => {
    expect(getToken()).toBeNull();
    setToken('ignored');
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe('api request', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=test-token';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: '1', email: 'a@b.de', displayName: null, isAdmin: false } }),
    }) as unknown as typeof fetch;
  });

  it('sends credentials and CSRF header on POST', async () => {
    const { authApi } = await import('../../lib/api');
    await authApi.login('a@b.de', 'password123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'test-token' }),
      }),
    );
  });
});
