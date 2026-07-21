import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings } from '../../hooks/useSettings';
import { useOffline } from '../../hooks/useOffline';

describe('useSettings', () => {
  beforeEach(() => localStorage.clear());

  it('loads defaults and updates settings', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.language).toBe('de');
    act(() => result.current.update({ language: 'en' }));
    expect(result.current.settings.language).toBe('en');
    expect(localStorage.getItem('privmail-settings')).toContain('en');
  });
});

describe('useOffline', () => {
  it('reflects navigator.onLine', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { result } = renderHook(() => useOffline());
    expect(result.current.isOffline).toBe(false);
  });
});

describe('useAuth', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: '1', email: 'a@b.de', displayName: null, isAdmin: false } }),
    }) as unknown as typeof fetch;
    document.cookie = 'XSRF-TOKEN=t';
  });

  it('loads current user', async () => {
    const { useAuth } = await import('../../hooks/useAuth');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.email).toBe('a@b.de');
  });
});

describe('useSearch', () => {
  it('searches locally', async () => {
    const { useSearch } = await import('../../hooks/useSearch');
    const { result } = renderHook(() => useSearch());
    await act(async () => {
      await result.current.search('hello');
    });
    expect(result.current.searched).toBe(true);
  });
});

describe('useAI', () => {
  beforeEach(() => {
    localStorage.setItem(
      'privmail-ai-config',
      JSON.stringify({ provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3', enabled: false }),
    );
  });

  it('exposes AI helpers', async () => {
    const { useAI } = await import('../../hooks/useAI');
    const { result } = renderHook(() => useAI());
    expect(result.current.enabled).toBe(false);
    expect(typeof result.current.summarize).toBe('function');
    expect(typeof result.current.toneCheck).toBe('function');
  });
});
