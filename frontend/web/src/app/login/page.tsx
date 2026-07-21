'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const interaction = searchParams.get('interaction');
  const { login, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientLabel, setClientLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!interaction) return;
    api
      .get<{ params: { client_id?: string } }>(`/oidc/interaction/${encodeURIComponent(interaction)}`)
      .then((d) => setClientLabel(String(d.params.client_id ?? 'App')))
      .catch(() => setClientLabel(null));
  }, [interaction]);

  // Already logged in + OIDC interaction → finish without re-entering credentials.
  useEffect(() => {
    if (!interaction || authLoading || !user) return;
    void confirmInteraction(interaction).catch((err) => {
      setError((err as Error).message);
    });
    // intentionally only when session becomes available for this interaction
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, authLoading, user]);

  async function confirmInteraction(uid: string) {
    setLoading(true);
    try {
      // interactionFinished redirects the browser via Location header.
      const xsrf =
        document.cookie
          .split('; ')
          .find((c) => c.startsWith('XSRF-TOKEN='))
          ?.split('=')
          .slice(1)
          .join('=') ?? '';
      const res = await fetch(`${API_BASE}/api/oidc/interaction/${encodeURIComponent(uid)}/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': xsrf,
        },
        body: '{}',
        redirect: 'manual',
      });
      const location = res.headers.get('Location');
      if (location) {
        window.location.href = location;
        return;
      }
      if (res.status >= 300 && res.status < 400) {
        window.location.reload();
        return;
      }
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || 'OIDC-Bestätigung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      if (interaction) {
        await confirmInteraction(interaction);
        return;
      }
      router.replace('/dashboard/inbox');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Logo size={36} textClassName="text-xl" />
          </div>
          {interaction && (
            <p className="text-sm text-muted-foreground">
              Anmeldung für {clientLabel ?? 'eine verbundene App'} (SSO)
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="email"
              placeholder="E-Mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Anmelden…' : interaction ? 'Anmelden & fortfahren' : 'Anmelden'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-4 text-sm text-muted-foreground">
          Laden…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
