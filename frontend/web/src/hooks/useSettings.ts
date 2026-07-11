'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  signature: string;
  autoDecrypt: boolean;
}

const DEFAULTS: UserSettings = {
  theme: 'system',
  language: 'de',
  signature: '',
  autoDecrypt: true,
};

const STORAGE_KEY = 'privmail-settings';

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setSettings({ ...DEFAULTS, ...JSON.parse(saved) });
  }, []);

  const update = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, update };
}
