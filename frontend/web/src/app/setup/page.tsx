'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';

interface WizardStatus {
  hostConfigRequired?: boolean;
  hostWizardCommand?: string;
  checks?: {
    domain?: boolean;
    suite?: {
      domain?: string;
      vaultHost?: string;
      photosHost?: string;
    };
  };
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'domain' | 'admin'>('admin');
  const [status, setStatus] = useState<WizardStatus | null>(null);
  const [domain, setDomain] = useState('');
  const [vaultHost, setVaultHost] = useState('');
  const [photosHost, setPhotosHost] = useState('');
  const [derivedCmd, setDerivedCmd] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<WizardStatus>('/setup-wizard/status')
      .then((s) => {
        setStatus(s);
        if (s.hostConfigRequired) setStep('domain');
        else setStep('admin');
        if (s.checks?.suite?.domain) setDomain(s.checks.suite.domain);
        if (s.checks?.suite?.vaultHost) setVaultHost(s.checks.suite.vaultHost);
        if (s.checks?.suite?.photosHost) setPhotosHost(s.checks.suite.photosHost);
      })
      .catch(() => setStep('admin'));
  }, []);

  useEffect(() => {
    if (!domain.trim()) return;
    const d = domain.trim().toLowerCase();
    if (!vaultHost) setVaultHost(`vault.${d}`);
    if (!photosHost) setPhotosHost(`photos.${d}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const deriveHosts = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{
        applyOnHost: string[];
        dnsRecords: { host: string; value: string }[];
      }>('/setup-wizard/derive-suite-config', {
        domain: domain.trim().toLowerCase(),
        vaultHost: vaultHost.trim().toLowerCase() || undefined,
        photosHost: photosHost.trim().toLowerCase() || undefined,
      });
      setDerivedCmd(res.applyOnHost.join('\n'));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.setup(email, password, displayName || undefined);
      router.replace('/dashboard/apps');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2">
            <Logo size={36} textClassName="text-xl" />
          </div>
          <CardTitle>PrivMail Suite einrichten</CardTitle>
          <p className="text-sm text-muted-foreground">
            Jeder Betreiber betreibt eine eigene, unabhängige Instanz mit seiner eigenen Domain.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 'domain' && (
            <form onSubmit={deriveHosts} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Domain und Subdomains werden auf dem Server in <code>.env</code> und Nginx geschrieben.
                Empfohlen: Host-Wizard ausführen.
              </p>
              <code className="rounded bg-muted px-2 py-1 text-xs">
                {status?.hostWizardCommand ?? './scripts/setup-wizard.sh'}
              </code>
              <Input
                placeholder="Deine Domain (z. B. mail.example.org)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
              <Input
                placeholder="Vaultwarden-Host"
                value={vaultHost}
                onChange={(e) => setVaultHost(e.target.value)}
              />
              <Input
                placeholder="Immich-Host"
                value={photosHost}
                onChange={(e) => setPhotosHost(e.target.value)}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading}>
                {loading ? '…' : 'Befehle für den Server anzeigen'}
              </Button>
              {derivedCmd && (
                <pre className="overflow-x-auto rounded border border-border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                  {derivedCmd}
                </pre>
              )}
              <Button type="button" variant="outline" onClick={() => setStep('admin')}>
                Weiter zum Admin-Konto
              </Button>
            </form>
          )}

          {step === 'admin' && (
            <form onSubmit={handleAdmin} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Erstelle das erste Administrator-Konto.</p>
              <Input
                placeholder="Anzeigename"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <Input
                type="email"
                placeholder="E-Mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Passwort (min. 8 Zeichen)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading}>
                {loading ? 'Einrichten…' : 'Konto erstellen'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
