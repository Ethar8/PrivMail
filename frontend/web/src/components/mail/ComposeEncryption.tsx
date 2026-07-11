'use client';

import { Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

interface ComposeEncryptionProps {
  encrypt: boolean;
  onEncryptChange: (encrypt: boolean) => void;
  recipientKey: string;
  onRecipientKeyChange: (key: string) => void;
}

export function ComposeEncryption({
  encrypt,
  onEncryptChange,
  recipientKey,
  onRecipientKeyChange,
}: ComposeEncryptionProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={encrypt} onCheckedChange={(c) => onEncryptChange(c === true)} />
        <Lock size={14} /> Ende-zu-Ende verschlüsseln (OpenPGP)
      </label>
      {encrypt && (
        <Textarea
          placeholder="Öffentlicher PGP-Schlüssel des Empfängers…"
          value={recipientKey}
          onChange={(e) => onRecipientKeyChange(e.target.value)}
          rows={4}
          className="font-mono text-xs"
        />
      )}
    </div>
  );
}
