'use client';

import { useState, useCallback } from 'react';
import { searchEmailsLocally } from '@/lib/search';
import { LocalEmail } from '@/lib/db';

export function useSearch() {
  const [results, setResults] = useState<LocalEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (query: string, mailbox?: string) => {
    setLoading(true);
    setError(null);
    try {
      setResults(await searchEmailsLocally(query, mailbox));
      setSearched(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, searched, search };
}
