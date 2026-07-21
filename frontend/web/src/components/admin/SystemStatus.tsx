'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Status {
  users: number;
  emails: number;
  queueSize: number;
  uptime: number;
  memory?: {
    rss: number;
    totalMem: number;
    freeMem: number;
    usedMemPercent: number;
  };
  cpu?: {
    count: number;
    load1: number;
    load5: number;
    load15: number;
    loadPercent: number;
  };
  suite?: {
    oidc: {
      issuer: string;
      discoveryReachable: boolean;
      discoveryUrl: string;
      lastSuccessfulLogin: string | null;
    };
    vaultwarden: {
      name: string;
      reachable: boolean;
      url: string;
      detail?: string;
    };
    immich: {
      name: string;
      reachable: boolean;
      url: string;
      detail?: string;
    };
  };
}

function Reach({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'text-emerald-600' : 'text-red-600'}>
      {ok ? 'erreichbar' : 'nicht erreichbar'}
    </span>
  );
}

export function SystemStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    api
      .get<Status>('/admin/status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return <p className="text-sm text-muted-foreground">Lade Status…</p>;

  const items = [
    { label: 'Nutzer', value: status.users },
    { label: 'E-Mails', value: status.emails },
    { label: 'Warteschlange', value: status.queueSize },
    { label: 'Laufzeit', value: `${Math.floor(status.uptime / 60)} min` },
    {
      label: 'Speicher',
      value: `${Math.round((status.memory?.rss ?? 0) / 1024 / 1024)} MB (${status.memory?.usedMemPercent ?? 0}% genutzt)`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {items.map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {status.suite && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">OIDC (PrivMail IdP)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Discovery: <Reach ok={status.suite.oidc.discoveryReachable} />
              </p>
              <p className="break-all text-xs text-muted-foreground">
                {status.suite.oidc.discoveryUrl}
              </p>
              <p>
                Letzter SSO-Login:{' '}
                {status.suite.oidc.lastSuccessfulLogin
                  ? new Date(status.suite.oidc.lastSuccessfulLogin).toLocaleString()
                  : 'noch keiner'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Vaultwarden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Status: <Reach ok={status.suite.vaultwarden.reachable} />
              </p>
              <a
                className="text-xs text-muted-foreground underline"
                href={status.suite.vaultwarden.url}
                target="_blank"
                rel="noreferrer"
              >
                {status.suite.vaultwarden.url}
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Immich</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Status: <Reach ok={status.suite.immich.reachable} />
              </p>
              <a
                className="text-xs text-muted-foreground underline"
                href={status.suite.immich.url}
                target="_blank"
                rel="noreferrer"
              >
                {status.suite.immich.url}
              </a>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
