'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Status {
  users: number;
  emails: number;
  queueSize: number;
  uptime: number;
  memory: number;
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
    { label: 'Speicher', value: `${Math.round(status.memory / 1024 / 1024)} MB` },
  ];

  return (
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
  );
}
