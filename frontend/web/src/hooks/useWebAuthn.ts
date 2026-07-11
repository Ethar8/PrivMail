'use client';

import { useState, useCallback } from 'react';
import { registerWebAuthn, loginWebAuthn, isWebAuthnAvailable } from '@/lib/webauthn';

export function useWebAuthn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async (userId: string, userName: string) => {
    setLoading(true);
    setError(null);
    try {
      await registerWebAuthn(userId, userName);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await loginWebAuthn();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { register, login, loading, error, available: isWebAuthnAvailable() };
}
