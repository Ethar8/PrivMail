'use client';

import { useState } from 'react';
import {
  Send,
  ShieldCheck,
  Shield,
  Sparkles,
  AlignLeft,
  AlignJustify,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ComposeRecipients } from './ComposeRecipients';
import { ComposeEditor } from './ComposeEditor';
import { ComposeEncryption } from './ComposeEncryption';
import { ComposeAttachments } from './ComposeAttachments';
import { mailApi, externalApi, aliasesApi, attachmentShareApi, AliasRow } from '@/lib/api';
import { encryptMessage } from '@/lib/pgp';
import { buildProtectedMessage } from '@/lib/rfc9788';
import { useAuth } from '@/hooks/useAuth';
import {
  checkToneBeforeSend,
  isAIEnabled,
  rewriteLength,
  rewriteTone,
  draftFromBullets,
  loadAIConfig,
} from '@/lib/ai';
import { useEffect } from 'react';

interface Props {
  initialTo?: string;
  initialSubject?: string;
  onSent?: () => void;
}

async function filesToAttachments(files: File[]): Promise<{ filename: string; contentType: string; data: string }[]> {
  const out: { filename: string; contentType: string; data: string }[] = [];
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    out.push({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      data: btoa(binary),
    });
  }
  return out;
}

export function ComposeForm({ initialTo = '', initialSubject = '', onSent }: Props) {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState({ to: initialTo, cc: '', bcc: '' });
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [encrypt, setEncrypt] = useState(false);
  const [protectHeaders, setProtectHeaders] = useState(false);
  const [recipientKey, setRecipientKey] = useState('');
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [externalPassword, setExternalPassword] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toneHint, setToneHint] = useState<string | null>(null);
  const [toneBypass, setToneBypass] = useState(false);
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [fromAddress, setFromAddress] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [bullets, setBullets] = useState('');
  const [shareInfo, setShareInfo] = useState<string | null>(null);
  const cloudAi = loadAIConfig()?.provider !== 'ollama' && isAIEnabled();

  useEffect(() => {
    if (user?.email) setFromAddress(user.email);
    void aliasesApi
      .list()
      .then((r) => setAliases(r.aliases.filter((a) => a.is_active)))
      .catch(() => undefined);
  }, [user?.email]);

  const runAi = async (fn: () => Promise<string>) => {
    setAiBusy(true);
    setError(null);
    try {
      setBody(await fn());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const handleQuickAlias = async () => {
    try {
      const { alias } = await aliasesApi.quick('Compose');
      setAliases((prev) => [alias, ...prev]);
      setFromAddress(alias.alias_email);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleShareAttachment = async () => {
    if (files.length === 0) {
      setError('Bitte zuerst eine Datei anhängen');
      return;
    }
    const pwd = window.prompt('Passwort für den Freigabelink:');
    if (!pwd || pwd.length < 4) return;
    const expiresIn = (window.prompt('Ablauf (1h/24h/7d/30d):', '7d') || '7d') as
      | '1h'
      | '24h'
      | '7d'
      | '30d';
    try {
      const att = (await filesToAttachments([files[0]!]))[0]!;
      const share = await attachmentShareApi.create({
        filename: att.filename,
        contentType: att.contentType,
        data: att.data,
        password: pwd,
        expiresIn,
      });
      const link = `${typeof window !== 'undefined' ? window.location.origin : ''}${share.linkPath}`;
      setShareInfo(`Freigabelink (0 Abrufe): ${link}`);
      setBody((b) => `${b}\n\nAnhang-Freigabe: ${link}\n`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      if (isAIEnabled() && !toneBypass && body.trim()) {
        const tone = await checkToneBeforeSend(body);
        if (tone.shouldReview && tone.hint) {
          setToneHint(tone.hint);
          setSending(false);
          return;
        }
      }

      const to = recipients.to.split(',').map((s) => s.trim()).filter(Boolean);
      const attachments = files.length > 0 ? await filesToAttachments(files) : undefined;
      let finalBody = body;
      let finalSubject = subject;

      if (passwordProtect && externalPassword && to[0]) {
        const result = await externalApi.encrypt({
          recipientEmail: to[0],
          subject,
          body,
          password: externalPassword,
          expiresIn: '7d',
        });
        finalSubject = 'Passwortgeschützte Nachricht';
        finalBody =
          `Sie haben eine passwortgeschützte Nachricht erhalten.\n\n` +
          `Öffnen Sie den Link und geben Sie das vereinbarte Passwort ein:\n` +
          `${typeof window !== 'undefined' ? window.location.origin : ''}${result.linkPath}\n`;
        await mailApi.send({ to, subject: finalSubject, body: finalBody, attachments, from: fromAddress });
      } else if (encrypt && recipientKey.trim()) {
        finalBody = await encryptMessage(body, recipientKey.trim());
        if (protectHeaders) {
          const raw = await buildProtectedMessage({
            headers: {
              subject,
              from: fromAddress || user?.email || '',
              to: to.join(', '),
              cc: recipients.cc || undefined,
              date: new Date().toUTCString(),
            },
            encryptedBody: finalBody,
            recipientPublicKey: recipientKey.trim(),
          });
          await mailApi.send({
            to,
            subject: '[...]',
            body: finalBody,
            raw,
            isEncrypted: true,
            attachments,
            from: fromAddress,
          });
        } else {
          await mailApi.send({
            to,
            subject: finalSubject,
            body: finalBody,
            isEncrypted: true,
            attachments,
            from: fromAddress,
          });
        }
      } else {
        await mailApi.send({
          to,
          subject: finalSubject,
          body: finalBody,
          isEncrypted: false,
          attachments,
          from: fromAddress,
        });
      }

      onSent?.();
      setRecipients({ to: '', cc: '', bcc: '' });
      setSubject('');
      setBody('');
      setFiles([]);
      setEncrypt(false);
      setProtectHeaders(false);
      setPasswordProtect(false);
      setExternalPassword('');
      setToneHint(null);
      setToneBypass(false);
      setShareInfo(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const primaryRecipient = recipients.to.split(',')[0]?.trim() ?? '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground" htmlFor="compose-from">
          Von
        </label>
        <select
          id="compose-from"
          className="h-9 rounded border border-border bg-background px-2 text-sm"
          value={fromAddress}
          onChange={(e) => setFromAddress(e.target.value)}
          aria-label="Absenderadresse"
        >
          {user?.email && <option value={user.email}>{user.email}</option>}
          {aliases.map((a) => (
            <option key={a.id} value={a.alias_email}>
              {a.alias_email}
              {a.label ? ` (${a.label})` : ''}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={() => void handleQuickAlias()} aria-label="Ein-Klick-Alias">
          <Shield size={14} aria-hidden="true" /> Alias
        </Button>
      </div>

      <ComposeRecipients value={recipients} onChange={setRecipients} />
      <Input placeholder="Betreff" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Betreff" />
      <ComposeEditor value={body} onChange={setBody} />

      <div className="flex flex-col gap-2 rounded border border-border p-3" role="toolbar" aria-label="KI-Schreibassistent">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles size={14} aria-hidden="true" /> Schreibassistent
          {cloudAi && (
            <span className="text-xs text-amber-700 dark:text-amber-300" role="note">
              Cloud-KI aktiv – Daten gehen an einen externen Anbieter
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={aiBusy || !body} onClick={() => void runAi(() => rewriteLength(body, 'longer'))}>
            <AlignJustify size={14} /> Verlängern
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={aiBusy || !body} onClick={() => void runAi(() => rewriteLength(body, 'shorter'))}>
            <AlignLeft size={14} /> Kürzen
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={aiBusy || !body} onClick={() => void runAi(() => rewriteTone(body, 'formal'))}>
            Formell
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={aiBusy || !body} onClick={() => void runAi(() => rewriteTone(body, 'friendly'))}>
            Freundlich
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={aiBusy || !body} onClick={() => void runAi(() => rewriteTone(body, 'direct'))}>
            Direkt
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Stichpunkte → Entwurf…"
            value={bullets}
            onChange={(e) => setBullets(e.target.value)}
            aria-label="Stichpunkte für KI-Entwurf"
          />
          <Button
            type="button"
            size="sm"
            disabled={aiBusy || !bullets.trim()}
            onClick={() => void runAi(() => draftFromBullets(bullets))}
          >
            Entwurf
          </Button>
        </div>
      </div>

      <ComposeEncryption
        encrypt={encrypt}
        onEncryptChange={setEncrypt}
        recipientKey={recipientKey}
        onRecipientKeyChange={setRecipientKey}
        recipientEmail={primaryRecipient}
        passwordProtect={passwordProtect}
        onPasswordProtectChange={setPasswordProtect}
        externalPassword={externalPassword}
        onExternalPasswordChange={setExternalPassword}
      />
      {encrypt && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={protectHeaders}
            onChange={(e) => setProtectHeaders(e.target.checked)}
            aria-label="Header verschlüsseln"
          />
          <ShieldCheck size={14} className="text-primary" aria-hidden="true" />
          Header verschlüsseln (RFC 9788)
        </label>
      )}
      <ComposeAttachments files={files} onChange={setFiles} />
      <Button type="button" variant="outline" size="sm" onClick={() => void handleShareAttachment()}>
        <Link2 size={14} /> Anhang-Freigabelink
      </Button>
      {shareInfo && (
        <p className="text-xs text-muted-foreground" role="status">
          {shareInfo}
        </p>
      )}
      {toneHint && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="alert">
          <p className="mb-2">{toneHint}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setToneHint(null); setToneBypass(false); }}>
              Überarbeiten
            </Button>
            <Button type="button" size="sm" onClick={() => { setToneBypass(true); setToneHint(null); void handleSend(); }}>
              Trotzdem senden
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div>
        <Button onClick={handleSend} disabled={sending} aria-label="E-Mail senden">
          <Send size={16} aria-hidden="true" /> {sending ? 'Senden…' : 'Senden'}
        </Button>
      </div>
    </div>
  );
}
