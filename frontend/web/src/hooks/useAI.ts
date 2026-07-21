'use client';

import { useState, useCallback } from 'react';
import { summarizeEmail, suggestReply, loadAIConfig, isAIEnabled, summarizeThread, checkToneBeforeSend, naturalLanguageToSearchTerms } from '@/lib/ai';

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summarize = useCallback(async (content: string): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      return await summarizeEmail(content);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reply = useCallback(async (content: string): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      return await suggestReply(content);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const summarizeThreadMessages = useCallback(async (threadId: string, messages: string[]): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      return await summarizeThread(threadId, messages);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const toneCheck = useCallback(async (body: string) => checkToneBeforeSend(body), []);

  const toSearchTerms = useCallback(async (query: string) => naturalLanguageToSearchTerms(query), []);

  return {
    loading,
    error,
    summarize,
    reply,
    summarizeThread: summarizeThreadMessages,
    toneCheck,
    toSearchTerms,
    enabled: isAIEnabled(),
    config: loadAIConfig(),
  };
}
