/**
 * @jest-environment jsdom
 */
import {
  configureAI,
  loadAIConfig,
  saveSecurityConfig,
  loadSecurityConfig,
  isSecurityCheckEnabled,
  isAIEnabled,
  summarizeEmail,
  suggestReply,
  summarizeThread,
  clearThreadSummaryCache,
  checkToneBeforeSend,
  naturalLanguageToSearchTerms,
  suggestPasswordProtection,
} from '@/lib/ai';

describe('ai lib', () => {
  beforeEach(() => {
    localStorage.clear();
    clearThreadSummaryCache();
    global.fetch = jest.fn();
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: false,
    });
  });

  it('persists AI and security config', () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: true,
    });
    expect(loadAIConfig()?.model).toBe('llama3');
    expect(isAIEnabled()).toBe(true);

    saveSecurityConfig({ enabled: true });
    expect(loadSecurityConfig()?.enabled).toBe(true);
    expect(isSecurityCheckEnabled()).toBe(true);
  });

  it('returns neutral tone when AI disabled', async () => {
    const tone = await checkToneBeforeSend('Du Idiot!');
    expect(tone.shouldReview).toBe(false);
    expect(tone.tone).toBe('neutral');
  });

  it('suggestPasswordProtection returns null when AI off or has key', async () => {
    await expect(suggestPasswordProtection('a@b.c', true)).resolves.toBeNull();
    // When AI is off, returns null (no network)
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: false,
    });
    await expect(suggestPasswordProtection('a@b.c', false)).resolves.toBeNull();
  });

  it('naturalLanguageToSearchTerms returns query when AI disabled', async () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: false,
    });
    await expect(naturalLanguageToSearchTerms('mails von anna')).resolves.toBe('mails von anna');
  });

  it('calls ollama for summarizeEmail when enabled', async () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Kurzfassung' }),
    });
    await expect(summarizeEmail('Hallo Welt')).resolves.toBe('Kurzfassung');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('caches thread summaries in session', async () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Punkte' }),
    });
    const a = await summarizeThread('t1', ['m1', 'm2']);
    const b = await summarizeThread('t1', ['m1', 'm2']);
    expect(a).toBe('Punkte');
    expect(b).toBe('Punkte');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('suggestReply uses complete()', async () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Danke für Ihre Nachricht' }),
    });
    await expect(suggestReply('Bitte um Termin')).resolves.toContain('Danke');
  });

  it('checkToneBeforeSend parses JSON from model', async () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          tone: 'harsh',
          shouldReview: true,
          hint: 'Zu schroff',
        }),
      }),
    });
    const tone = await checkToneBeforeSend('Das ist inakzeptabel!!!');
    expect(tone.shouldReview).toBe(true);
    expect(tone.hint).toBe('Zu schroff');
  });

  it('naturalLanguageToSearchTerms uses AI when enabled', async () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Anna Anhang' }),
    });
    await expect(naturalLanguageToSearchTerms('Mails von Anna mit Anhang')).resolves.toBe('Anna Anhang');
  });
});
