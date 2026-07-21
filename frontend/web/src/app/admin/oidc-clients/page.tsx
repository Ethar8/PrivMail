'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface OidcClient {
  clientId: string;
  name: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  scope: string;
  isActive: boolean;
  createdAt: string;
  clientSecret?: string;
}

export default function OidcClientsAdminPage() {
  const [issuer, setIssuer] = useState('');
  const [discovery, setDiscovery] = useState('');
  const [clients, setClients] = useState<OidcClient[]>([]);
  const [name, setName] = useState('');
  const [redirectUris, setRedirectUris] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  async function load() {
    const data = await api.get<{ issuer: string; discovery: string; clients: OidcClient[] }>(
      '/admin/oidc-clients',
    );
    setIssuer(data.issuer);
    setDiscovery(data.discovery);
    setClients(data.clients);
  }

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, []);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedSecret(null);
    try {
      const res = await api.post<{ client: OidcClient }>('/admin/oidc-clients', {
        name,
        redirectUris: redirectUris
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setCreatedSecret(res.client.clientSecret ?? null);
      setName('');
      setRedirectUris('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function rotateSecret(clientId: string) {
    const res = await api.post<{ client: OidcClient }>(
      `/admin/oidc-clients/${encodeURIComponent(clientId)}/rotate-secret`,
      {},
    );
    setCreatedSecret(res.client.clientSecret ?? null);
    await load();
  }

  async function remove(clientId: string) {
    if (!confirm(`Client „${clientId}“ wirklich löschen?`)) return;
    await api.del(`/admin/oidc-clients/${encodeURIComponent(clientId)}`);
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">OIDC-Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registrierte Relying Parties (Vaultwarden, Immich, …). Issuer:{' '}
          <code className="text-xs">{issuer}</code>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Discovery: <code>{discovery}</code>
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {createdSecret && (
        <div className="rounded-[var(--radius)] border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Neues Client-Secret (nur einmal sichtbar):{' '}
          <code className="break-all">{createdSecret}</code>
        </div>
      )}

      <form onSubmit={createClient} className="space-y-3 rounded-[var(--radius)] border border-border p-4">
        <h2 className="font-medium">Neuen Client anlegen</h2>
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <textarea
          className="min-h-[88px] w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm"
          placeholder="Redirect-URIs (eine pro Zeile)"
          value={redirectUris}
          onChange={(e) => setRedirectUris(e.target.value)}
          required
        />
        <Button type="submit">Anlegen</Button>
      </form>

      <ul className="space-y-3">
        {clients.map((c) => (
          <li key={c.clientId} className="rounded-[var(--radius)] border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {c.name}{' '}
                  <span className="text-xs text-muted-foreground">({c.clientId})</span>
                  {!c.isActive && (
                    <span className="ml-2 text-xs text-amber-600">inaktiv</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Scope: {c.scope}</p>
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {c.redirectUris.map((u) => (
                    <li key={u}>
                      <code>{u}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => rotateSecret(c.clientId)}>
                  Secret rotieren
                </Button>
                <Button type="button" variant="outline" onClick={() => remove(c.clientId)}>
                  Löschen
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
