'use client';

import { useState } from 'react';
import { Lock, Trash2, Reply, ShieldCheck, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AISummary } from '@/components/ai/AISummary';
import { isHeaderProtected, decryptProtectedMessage } from '@/lib/rfc9788-viewer';

interface EmailDetail {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  raw?: string;
  received_at: string;
  is_encrypted: boolean;
}

interface Props {
  email: EmailDetail | null;
  onDelete?: (id: string) => void;
  onReply?: (email: EmailDetail) => void;
}

export function EmailView({ email, onDelete, onReply }: Props) {
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [decrypted, setDecrypted] = useState<{ subject: string; from: string; to: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Wähle eine E-Mail aus.
      </div>
    );
  }

  const protectedMsg = !!email.raw && isHeaderProtected(email.raw);

  const handleDecrypt = async () => {
    if (!email.raw) return;
    setBusy(true);
    setError(null);
    try {
      const result = await decryptProtectedMessage(email.raw, privateKey.trim(), passphrase);
      setDecrypted({
        subject: result.headers.subject,
        from: result.headers.from,
        to: result.headers.to,
        body: result.body,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shownSubject = decrypted?.subject ?? email.subject;
  const shownFrom = decrypted?.from ?? email.from_email;
  const shownTo = decrypted?.to ?? email.to_email;
  const shownBody = decrypted?.body ?? email.body;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-6">
        <div className="mb-2 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold">{shownSubject}</h1>
          <div className="flex gap-1">
            {onReply && (
              <Button variant="ghost" size="icon" onClick={() => onReply(email)} aria-label="Antworten">
                <Reply size={18} />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(email.id)} aria-label="Löschen">
                <Trash2 size={18} />
              </Button>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <div>Von: {shownFrom}</div>
          <div>An: {shownTo}</div>
          <div>{new Date(email.received_at).toLocaleString()}</div>
        </div>
        {email.is_encrypted && (
          <div className="mt-2 flex items-center gap-2 text-xs text-primary">
            <Lock size={12} /> Ende-zu-Ende-verschlüsselt (OpenPGP)
          </div>
        )}
        {protectedMsg && (
          <div className="mt-1 flex items-center gap-2 text-xs text-primary">
            <ShieldCheck size={12} /> Header-geschützt (RFC 9788)
            {decrypted && <span className="text-emerald-500">· entschlüsselt</span>}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {protectedMsg && !decrypted && (
          <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
              <ShieldCheck size={14} className="text-primary" />
              Diese Nachricht ist header-geschützt. Zum Anzeigen entschlüsseln:
            </p>
            <textarea
              placeholder="Privater PGP-Schlüssel"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              rows={4}
              className="mb-2 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
            />
            <input
              type="password"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="mb-2 w-full rounded-md border border-border bg-background p-2 text-sm"
            />
            {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
            <Button onClick={handleDecrypt} disabled={busy || !privateKey || !passphrase} className="gap-2">
              <Unlock size={16} /> {busy ? 'Entschlüsseln…' : 'Entschlüsseln'}
            </Button>
          </div>
        )}

        {(!protectedMsg || decrypted) && <AISummary content={shownBody} />}
        <div className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap dark:prose-invert">
          {protectedMsg && !decrypted ? '🔒 Inhalt verschlüsselt' : shownBody}
        </div>
      </div>
    </div>
  );
}
