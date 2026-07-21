import {
  configureAI,
  loadAIConfig,
  isAIEnabled,
  saveSecurityConfig,
  loadSecurityConfig,
  isSecurityCheckEnabled,
  clearThreadSummaryCache,
} from '../../lib/ai';

describe('ai config', () => {
  beforeEach(() => {
    localStorage.clear();
    clearThreadSummaryCache();
  });

  it('stores and loads AI config', () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: true,
    });
    const cfg = loadAIConfig();
    expect(cfg?.provider).toBe('ollama');
    expect(isAIEnabled()).toBe(true);
  });

  it('stores security check config', () => {
    saveSecurityConfig({ enabled: true });
    expect(isSecurityCheckEnabled()).toBe(true);
    expect(loadSecurityConfig()?.enabled).toBe(true);
  });

  it('returns false when AI disabled', () => {
    configureAI({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: false,
    });
    expect(isAIEnabled()).toBe(false);
  });
});
