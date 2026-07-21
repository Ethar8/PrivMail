import { configureAI, rewriteLength, rewriteTone, draftFromBullets, clearThreadSummaryCache } from '@/lib/ai';

describe('AI scribe helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    clearThreadSummaryCache();
    global.fetch = jest.fn();
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: true,
    });
  });

  it('rewriteLength longer/shorter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Umschriebener Text' }),
    });
    await expect(rewriteLength('kurz', 'longer')).resolves.toBe('Umschriebener Text');
    await expect(rewriteLength('sehr langer text hier', 'shorter')).resolves.toBe('Umschriebener Text');
  });

  it('rewriteTone variants', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Formell' }),
    });
    await expect(rewriteTone('hi', 'formal')).resolves.toBe('Formell');
    await expect(rewriteTone('hi', 'friendly')).resolves.toBe('Formell');
    await expect(rewriteTone('hi', 'direct')).resolves.toBe('Formell');
  });

  it('draftFromBullets', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Vollständige Mail' }),
    });
    await expect(draftFromBullets('- Punkt 1\n- Punkt 2')).resolves.toBe('Vollständige Mail');
  });

  it('throws when AI disabled', async () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: false,
    });
    await expect(rewriteLength('x', 'longer')).rejects.toThrow(/nicht aktiviert/i);
  });
});
