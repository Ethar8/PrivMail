'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { externalApi } from '@/lib/api';
import { decryptExternalMessage } from '@/lib/external-decrypt';

function ExternalMessageInner() {
  const params = useParams();
  const search = useSearchParams();
  const id = String(params.id ?? '');
  const code = search.get('code') ?? '';

  const [hint, setHint] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [plaintext, setPlaintext] = useState<{ subject: string | null; body: string } | null>(null);

  useEffect(() => {
    if (!id || !code) return;
    void externalApi
      .meta(id, code)
      .then((meta) => setHint(meta.passwordHint))
      .catch((err) => setError((err as Error).message));
  }, [id, code]);

  const handleUnlock = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await externalApi.ciphertext(id, password, code);
      const decrypted = await decryptExternalMessage(
        payload.encryptedBody,
        password,
        payload.encryptedSubject,
      );
      setPlaintext(decrypted);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-2">
        <Lock aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Passwortgeschützte Nachricht</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Die Entschlüsselung erfolgt ausschließlich in Ihrem Browser. Der Server speichert nur das
        Chiffrat.
      </p>
      {plaintext ? (
        <article className="rounded border border-border p-4" aria-live="polite">
          {plaintext.subject && <h2 className="mb-2 text-lg font-medium">{plaintext.subject}</h2>}
          <pre className="whitespace-pre-wrap font-sans text-sm">{plaintext.body}</pre>
        </article>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void handleUnlock();
          }}
        >
          {hint && (
            <p className="text-sm text-muted-foreground" role="note">
              Hinweis: {hint}
            </p>
          )}
          <label className="text-sm font-medium" htmlFor="ext-password">
            Passwort
          </label>
          <Input
            id="ext-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading || !password}>
            {loading ? 'Entschlüsseln…' : 'Nachricht öffnen'}
          </Button>
        </form>
      )}
    </main>
  );
}

export default function ExternalMessagePage() {
  return (
    <Suspense fallback={<main className="p-6">Laden…</main>}>
      <ExternalMessageInner />
    </Suspense>
  );
}
