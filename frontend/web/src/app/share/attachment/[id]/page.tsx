'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { attachmentShareApi } from '@/lib/api';
import { decryptPayloadInBrowser, parseEncryptedPayload } from '@/lib/external-decrypt';

function ShareInner() {
  const params = useParams();
  const search = useSearchParams();
  const id = String(params.id ?? '');
  const code = search.get('code') ?? '';
  const [meta, setMeta] = useState<{ filename: string; passwordHint: string | null; viewCount: number } | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || !code) return;
    void attachmentShareApi
      .meta(id, code)
      .then((m) =>
        setMeta({ filename: m.filename, passwordHint: m.passwordHint, viewCount: m.viewCount }),
      )
      .catch((err) => setError((err as Error).message));
  }, [id, code]);

  const unlock = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await attachmentShareApi.ciphertext(id, password, code);
      const b64 = await decryptPayloadInBrowser(parseEncryptedPayload(payload.encryptedPayload), password);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: payload.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = payload.filename;
      a.click();
      URL.revokeObjectURL(url);
      setMeta((m) => (m ? { ...m, viewCount: payload.viewCount } : m));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-2">
        <Link2 aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Geschützter Anhang</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Entschlüsselung nur im Browser. Datei: {meta?.filename ?? '…'}
        {meta ? ` · bisher ${meta.viewCount} Abrufe` : ''}
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void unlock();
        }}
      >
        {meta?.passwordHint && <p className="text-sm">Hinweis: {meta.passwordHint}</p>}
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Passwort"
          required
        />
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading || !password}>
          {loading ? 'Entschlüsseln…' : 'Herunterladen'}
        </Button>
      </form>
    </main>
  );
}

export default function AttachmentSharePage() {
  return (
    <Suspense fallback={<main className="p-6">Laden…</main>}>
      <ShareInner />
    </Suspense>
  );
}
