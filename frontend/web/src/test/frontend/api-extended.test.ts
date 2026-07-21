import { mailApi, aliasesApi, filtersApi, whitelistApi, externalApi, api } from '@/lib/api';

describe('api clients', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=csrf';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, aliases: [], rules: [], whitelist: [], blacklist: [] }),
    }) as unknown as typeof fetch;
  });

  it('mailApi.send posts attachments payload', async () => {
    await mailApi.send({
      to: ['a@b.de'],
      subject: 'Hi',
      body: 'Body',
      attachments: [{ filename: 'a.txt', contentType: 'text/plain', data: 'YQ==' }],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/mail/send'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('aliasesApi, filtersApi, whitelistApi, externalApi call endpoints', async () => {
    await aliasesApi.list();
    await filtersApi.list();
    await whitelistApi.list();
    await externalApi.encrypt({
      recipientEmail: 'ext@example.com',
      body: 'secret',
      password: 'pass1234',
    });
    await api.put('/filters/1', { isActive: false });
    await api.del('/admin/whitelist', { kind: 'whitelist', entry: 'x@y.z' });
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(6);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Nope' }),
    });
    await expect(aliasesApi.list()).rejects.toThrow('Nope');
  });
});
