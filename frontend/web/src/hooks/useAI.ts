'use client';

import { useState, useCallback } from 'react';
import { summarizeEmail, suggestReply, loadAIConfig, isAIEnabled } from '@/lib/ai';

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

  return { loading, error, summarize, reply, enabled: isAIEnabled(), config: loadAIConfig() };
}
