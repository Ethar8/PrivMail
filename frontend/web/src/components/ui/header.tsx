'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Bell, LogOut, Search } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';
import { useOffline } from '@/hooks/useOffline';

export function Header({ onLogout }: { onLogout?: () => void }) {
  const { theme, setTheme } = useTheme();
  const { isOffline } = useOffline();

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border px-6">
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Lokale Suche (privat)…" className="pl-9" />
      </div>
      {isOffline && (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          Offline-Modus
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Benachrichtigungen">
          <Bell size={18} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Theme wechseln"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
        {onLogout && (
          <Button variant="ghost" size="icon" aria-label="Abmelden" onClick={onLogout}>
            <LogOut size={18} />
          </Button>
        )}
      </div>
    </header>
  );
}
