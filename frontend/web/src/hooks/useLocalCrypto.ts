'use client';

import { useState, useCallback } from 'react';
import {
  setLocalPassphrase,
  hasLocalPassphrase,
  clearLocalPassphrase,
  encryptLocal,
  decryptLocal,
} from '@/lib/crypto-local';

/**
 * Hook around the session-scoped local passphrase used to E2E-encrypt personal
 * data (calendar/contacts) in the browser.
 */
export function useLocalCrypto() {
  const [unlocked, setUnlocked] = useState(hasLocalPassphrase());

  const unlock = useCallback((passphrase: string) => {
    setLocalPassphrase(passphrase);
    setUnlocked(true);
  }, []);

  const lock = useCallback(() => {
    clearLocalPassphrase();
    setUnlocked(false);
  }, []);

  return { unlocked, unlock, lock, encrypt: encryptLocal, decrypt: decryptLocal };
}
