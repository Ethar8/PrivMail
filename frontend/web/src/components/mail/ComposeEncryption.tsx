'use client';

import { useState, useEffect } from 'react';
import { Lock, KeyRound } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { suggestPasswordProtection } from '@/lib/ai';

interface ComposeEncryptionProps {
  encrypt: boolean;
  onEncryptChange: (encrypt: boolean) => void;
  recipientKey: string;
  onRecipientKeyChange: (key: string) => void;
  recipientEmail?: string;
  passwordProtect?: boolean;
  onPasswordProtectChange?: (enabled: boolean) => void;
  externalPassword?: string;
  onExternalPasswordChange?: (password: string) => void;
}

export function ComposeEncryption({
  encrypt,
  onEncryptChange,
  recipientKey,
  onRecipientKeyChange,
  recipientEmail = '',
  passwordProtect = false,
  onPasswordProtectChange,
  externalPassword = '',
  onExternalPasswordChange,
}: ComposeEncryptionProps) {
  const [aiHint, setAiHint] = useState<string | null>(null);

  useEffect(() => {
    if (!recipientEmail || encrypt || recipientKey.trim()) {
      setAiHint(null);
      return;
    }
    void suggestPasswordProtection(recipientEmail, false).then(setAiHint);
  }, [recipientEmail, encrypt, recipientKey]);

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Verschlüsselungsoptionen">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={encrypt} onCheckedChange={(c) => onEncryptChange(c === true)} aria-label="OpenPGP-Verschlüsselung aktivieren" />
        <Lock size={14} aria-hidden="true" /> Ende-zu-Ende verschlüsseln (OpenPGP)
      </label>
      {encrypt && (
        <Textarea
          placeholder="Öffentlicher PGP-Schlüssel des Empfängers…"
          value={recipientKey}
          onChange={(e) => onRecipientKeyChange(e.target.value)}
          rows={4}
          className="font-mono text-xs"
          aria-label="Öffentlicher PGP-Schlüssel"
        />
      )}
      {!encrypt && onPasswordProtectChange && (
        <>
          {aiHint && (
            <p className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200" role="note">
              {aiHint}
            </p>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={passwordProtect}
              onCheckedChange={(c) => onPasswordProtectChange(c === true)}
              aria-label="Passwortschutz für externe Empfänger"
            />
            <KeyRound size={14} aria-hidden="true" /> Passwortschutz (für Empfänger ohne PGP)
          </label>
          {passwordProtect && onExternalPasswordChange && (
            <Input
              type="password"
              placeholder="Passwort für den Empfänger…"
              value={externalPassword}
              onChange={(e) => onExternalPasswordChange(e.target.value)}
              aria-label="Passwort für externe Entschlüsselung"
            />
          )}
        </>
      )}
    </div>
  );
}
