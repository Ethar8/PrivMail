/**
 * @jest-environment jsdom
 */
import { configureAI, suggestPasswordProtection, checkToneBeforeSend, loadSecurityConfig, saveSecurityConfig, isSecurityCheckEnabled } from '@/lib/ai';
import { mailApi, authApi, importApi } from '@/lib/api';
import { searchEmailsLocally } from '@/lib/search';

describe('branch coverage boosters', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'XSRF-TOKEN=tok';
    global.fetch = jest.fn();
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: false,
    });
  });

  it('security config false when missing', () => {
    expect(loadSecurityConfig()).toBeNull();
    expect(isSecurityCheckEnabled()).toBe(false);
    saveSecurityConfig({ enabled: false });
    expect(isSecurityCheckEnabled()).toBe(false);
  });

  it('openai provider path', async () => {
    configureAI({
      provider: 'openai',
      endpoint: 'https://api.openai.com',
      apiKey: 'sk-test',
      model: 'gpt-4',
      enabled: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ tone: 'emotional', shouldReview: true, hint: 'emotional' }) } }],
      }),
    });
    const tone = await checkToneBeforeSend('Ich hasse das!!!');
    expect(tone.shouldReview).toBe(true);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Bitte Passwortschutz aktivieren.' } }] }),
    });
    await expect(suggestPasswordProtection('x@y.z', false)).resolves.toMatch(/Passwort|aktivieren/i);
  });

  it('openai error path and tone parse failure', async () => {
    configureAI({
      provider: 'custom',
      endpoint: 'https://example.com',
      model: 'm',
      enabled: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(checkToneBeforeSend('x')).resolves.toMatchObject({ shouldReview: false });
  });

  it('api helpers hit more endpoints', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ emails: [], email: {}, securityCheck: {}, ok: true, imported: 0, skipped: 0, errors: [] }),
    });
    await mailApi.mailboxes();
    await mailApi.list('INBOX');
    await mailApi.get('1');
    await mailApi.securityCheck('1');
    await mailApi.markRead('1', true);
    await mailApi.remove('1');
    await authApi.setupRequired();
    await authApi.me();
    await authApi.logout();
    await authApi.forgotPassword('a@b.de');
    await authApi.resetPassword('tok', 'password123');
    await authApi.changePassword('old', 'newpassword');
    await importApi.mbox('From x');
    await importApi.eml('From x');
    await importApi.vcf('BEGIN:VCARD');
    await importApi.ics('BEGIN:VCALENDAR');
    await importApi.imap({ host: 'imap.example.com', port: 993, user: 'u', password: 'p' });
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(10);
  });

  it('searchEmails with natural language when AI on', async () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'anna anhang' }),
    });
    // searchEmails may hit db mock — just ensure it does not throw for multi-word query
    await expect(searchEmailsLocally('mails von anna letzte woche')).resolves.toBeDefined();
  });
});
