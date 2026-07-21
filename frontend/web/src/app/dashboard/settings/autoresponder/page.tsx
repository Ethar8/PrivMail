'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';

interface Autoresponder {
  is_active: boolean;
  subject: string;
  body: string;
  start_at: string | null;
  end_at: string | null;
}

export default function AutoresponderSettingsPage() {
  const [form, setForm] = useState({
    enabled: false,
    subject: 'Abwesend',
    body: 'Ich bin derzeit nicht erreichbar und melde mich nach meiner Rückkehr.',
    startAt: '',
    endAt: '',
  });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void api
      .get<{ autoresponder: Autoresponder | null }>('/autoresponder')
      .then((data) => {
        const a = data.autoresponder;
        if (!a) return;
        setForm({
          enabled: a.is_active,
          subject: a.subject,
          body: a.body,
          startAt: a.start_at ? a.start_at.slice(0, 16) : '',
          endAt: a.end_at ? a.end_at.slice(0, 16) : '',
        });
      })
      .catch((err) => setStatus((err as Error).message));
  }, []);

  const save = async () => {
    setStatus(null);
    try {
      await api.post('/autoresponder', {
        isActive: form.enabled,
        subject: form.subject,
        body: form.body,
        startAt: form.startAt || undefined,
        endAt: form.endAt || undefined,
      });
      setStatus('Gespeichert');
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Abwesenheitsassistent</h1>
        <p className="text-sm text-muted-foreground">
          Automatische Antwort einmal pro Absender im gewählten Zeitraum (kein Spam-Loop).
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
          aria-label="Abwesenheitsassistent aktivieren"
        />
        Aktiv
      </label>
      <Input
        aria-label="Betreff der Abwesenheitsnotiz"
        value={form.subject}
        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
      />
      <Textarea
        aria-label="Text der Abwesenheitsnotiz"
        rows={6}
        value={form.body}
        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Von
          <Input
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          Bis
          <Input
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
          />
        </label>
      </div>
      <Button type="button" onClick={() => void save()}>
        Speichern
      </Button>
      {status && (
        <p className="text-sm" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
