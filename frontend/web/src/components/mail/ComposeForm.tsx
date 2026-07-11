'use client';

import { useState } from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ComposeRecipients } from './ComposeRecipients';
import { ComposeEditor } from './ComposeEditor';
import { ComposeEncryption } from './ComposeEncryption';
import { ComposeAttachments } from './ComposeAttachments';
import { mailApi } from '@/lib/api';
import { encryptMessage } from '@/lib/pgp';
import { buildProtectedMessage } from '@/lib/rfc9788';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  initialTo?: string;
  initialSubject?: string;
  onSent?: () => void;
}

export function ComposeForm({ initialTo = '', initialSubject = '', onSent }: Props) {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState({ to: initialTo, cc: '', bcc: '' });
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [encrypt, setEncrypt] = useState(false);
  const [protectHeaders, setProtectHeaders] = useState(false);
  const [recipientKey, setRecipientKey] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const to = recipients.to.split(',').map((s) => s.trim()).filter(Boolean);
      let finalBody = body;
      if (encrypt && recipientKey.trim()) {
        finalBody = await encryptMessage(body, recipientKey.trim());
      }

      // RFC 9788: when header protection is on (requires E2EE + recipient key),
      // build a wrapper message that hides the real headers and carries them
      // encrypted in the body. Sent via the raw field.
      if (encrypt && protectHeaders && recipientKey.trim()) {
        const raw = await buildProtectedMessage({
          headers: {
            subject,
            from: user?.email ?? '',
            to: to.join(', '),
            cc: recipients.cc || undefined,
            date: new Date().toUTCString(),
          },
          encryptedBody: finalBody,
          recipientPublicKey: recipientKey.trim(),
        });
        await mailApi.send({ to, subject: '[...]', body: finalBody, raw, isEncrypted: true });
      } else {
        await mailApi.send({ to, subject, body: finalBody, isEncrypted: encrypt });
      }

      onSent?.();
      setRecipients({ to: '', cc: '', bcc: '' });
      setSubject('');
      setBody('');
      setFiles([]);
      setEncrypt(false);
      setProtectHeaders(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ComposeRecipients value={recipients} onChange={setRecipients} />
      <Input placeholder="Betreff" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <ComposeEditor value={body} onChange={setBody} />
      <ComposeEncryption
        encrypt={encrypt}
        onEncryptChange={setEncrypt}
        recipientKey={recipientKey}
        onRecipientKeyChange={setRecipientKey}
      />
      {encrypt && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={protectHeaders}
            onChange={(e) => setProtectHeaders(e.target.checked)}
          />
          <ShieldCheck size={14} className="text-primary" />
          Header verschlüsseln (RFC 9788 – Betreff/Absender/Empfänger schützen)
        </label>
      )}
      <ComposeAttachments files={files} onChange={setFiles} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button onClick={handleSend} disabled={sending}>
          <Send size={16} /> {sending ? 'Senden…' : 'Senden'}
        </Button>
      </div>
    </div>
  );
}
