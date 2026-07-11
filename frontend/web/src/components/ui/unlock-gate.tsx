'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Inline gate that asks for the local passphrase before encrypted personal data
 * (calendar/contacts) can be created or read.
 */
export function UnlockGate({ onUnlock }: { onUnlock: (passphrase: string) => void }) {
  const [value, setValue] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value) onUnlock(value);
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-muted/30 p-8 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock size={22} />
      </div>
      <div>
        <h3 className="font-semibold">Ende-zu-Ende verschlüsselt</h3>
        <p className="text-sm text-muted-foreground">
          Gib dein lokales Passwort ein, um verschlüsselte Daten zu lesen und anzulegen. Es verlässt
          deinen Browser nicht.
        </p>
      </div>
      <Input
        type="password"
        placeholder="Lokales Passwort"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <Button type="submit" disabled={!value} className="w-full">
        Entsperren
      </Button>
    </form>
  );
}
