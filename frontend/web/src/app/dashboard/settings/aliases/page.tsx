'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Shield, Ban, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { aliasesApi, AliasRow } from '@/lib/api';

export default function AliasesSettingsPage() {
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [alias, setAlias] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const data = await aliasesApi.list();
    setAliases(data.aliases);
  };

  useEffect(() => {
    void reload().catch((err) => setError((err as Error).message));
  }, []);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await aliasesApi.create(alias.trim(), label.trim() || undefined);
      setAlias('');
      setLabel('');
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleQuick = async () => {
    setBusy(true);
    setError(null);
    try {
      await aliasesApi.quick(label.trim() || 'Ein-Klick-Alias');
      setLabel('');
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">E-Mail-Aliase</h1>
        <p className="text-sm text-muted-foreground">
          Hide-my-email: Nachrichten an aktive Aliase landen im Hauptpostfach. Gesperrte Aliase
          werden mit 550 abgewiesen. Antworten können über den Alias gesendet werden.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleQuick()} disabled={busy} aria-label="Ein-Klick-Alias erzeugen">
          <Shield size={16} aria-hidden="true" /> Ein-Klick-Alias
        </Button>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void handleCreate();
        }}
      >
        <Input
          aria-label="Neuer Alias"
          placeholder="alias@deine-domain.tld"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          type="email"
          required
        />
        <Input
          aria-label="Zweck / Label"
          placeholder="Label (z. B. Netflix)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          <Plus size={16} aria-hidden="true" /> Anlegen
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ul className="divide-y divide-border rounded border border-border" aria-label="Alias-Liste">
        {aliases.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                {a.alias_email}{' '}
                {!a.is_active && (
                  <span className="text-xs text-destructive">(gesperrt)</span>
                )}
              </p>
              <p className="text-muted-foreground">
                {a.label ? `Zweck: ${a.label} · ` : ''}
                Erstellt: {new Date(a.created_at).toLocaleString('de-DE')} · {a.mail_count} Mails
              </p>
              <Input
                className="mt-1 max-w-xs"
                aria-label={`Label für ${a.alias_email}`}
                placeholder="Label ändern…"
                defaultValue={a.label ?? ''}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v === (a.label ?? '')) return;
                  void aliasesApi
                    .patch(a.alias_email, { label: v || null })
                    .then(reload)
                    .catch((err) => setError((err as Error).message));
                }}
              />
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={a.is_active ? `Alias ${a.alias_email} sperren` : `Alias ${a.alias_email} aktivieren`}
                onClick={() =>
                  void aliasesApi
                    .patch(a.alias_email, { isActive: !a.is_active })
                    .then(reload)
                    .catch((err) => setError((err as Error).message))
                }
              >
                {a.is_active ? <Ban size={14} /> : <CheckCircle size={14} />}
                {a.is_active ? 'Sperren' : 'Aktivieren'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Alias ${a.alias_email} löschen`}
                onClick={() =>
                  void aliasesApi
                    .remove(a.alias_email)
                    .then(reload)
                    .catch((err) => setError((err as Error).message))
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </li>
        ))}
        {aliases.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">Noch keine Aliase.</li>
        )}
      </ul>
    </div>
  );
}
