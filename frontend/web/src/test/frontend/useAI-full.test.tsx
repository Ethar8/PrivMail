/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAI } from '@/hooks/useAI';
import * as ai from '@/lib/ai';

jest.mock('@/lib/ai', () => {
  const actual = jest.requireActual('@/lib/ai');
  return {
    ...actual,
    summarizeEmail: jest.fn(async () => 'Sum'),
    suggestReply: jest.fn(async () => 'Reply'),
    summarizeThread: jest.fn(async () => 'ThreadSum'),
    checkToneBeforeSend: jest.fn(async () => ({ shouldReview: true, hint: 'hart', tone: 'harsh' })),
    naturalLanguageToSearchTerms: jest.fn(async () => 'anna anhang'),
    isAIEnabled: jest.fn(() => true),
    loadAIConfig: jest.fn(() => ({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      enabled: true,
    })),
  };
});

describe('useAI full paths', () => {
  it('summarize, reply, thread, tone, search', async () => {
    const { result } = renderHook(() => useAI());
    await expect(result.current.summarize('x')).resolves.toBe('Sum');
    await expect(result.current.reply('x')).resolves.toBe('Reply');
    await expect(result.current.summarizeThread('t', ['a'])).resolves.toBe('ThreadSum');
    await expect(result.current.toneCheck('x')).resolves.toMatchObject({ shouldReview: true });
    await expect(result.current.toSearchTerms('q')).resolves.toBe('anna anhang');
    expect(result.current.enabled).toBe(true);
  });

  it('sets error when summarize fails', async () => {
    (ai.summarizeEmail as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAI());
    await act(async () => {
      await expect(result.current.summarize('x')).rejects.toThrow('boom');
    });
    await waitFor(() => expect(result.current.error).toBe('boom'));
  });
});
