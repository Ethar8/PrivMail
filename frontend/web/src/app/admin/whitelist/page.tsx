'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { whitelistApi } from '@/lib/api';

export default function WhitelistAdminPage() {
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [entry, setEntry] = useState('');
  const [kind, setKind] = useState<'whitelist' | 'blacklist'>('whitelist');
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const data = await whitelistApi.list();
    setWhitelist(data.whitelist);
    setBlacklist(data.blacklist);
  };

  useEffect(() => {
    void reload().catch((err) => setError((err as Error).message));
  }, []);

  const handleAdd = async () => {
    setError(null);
    try {
      await whitelistApi.add(kind, entry.trim());
      setEntry('');
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const renderList = (title: string, list: string[], listKind: 'whitelist' | 'blacklist') => (
    <section aria-labelledby={`${listKind}-heading`}>
      <h2 id={`${listKind}-heading`} className="mb-2 text-lg font-medium">
        {title}
      </h2>
      <ul className="divide-y divide-border rounded border border-border">
        {list.map((item) => (
          <li key={item} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{item}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`${item} entfernen`}
              onClick={() =>
                void whitelistApi
                  .remove(listKind, item)
                  .then(reload)
                  .catch((err) => setError((err as Error).message))
              }
            >
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground">Leer</li>
        )}
      </ul>
    </section>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Spam-Whitelist / Blacklist</h1>
        <p className="text-sm text-muted-foreground">
          Persistierte Absender- und Domain-Listen (PostgreSQL), verwaltet über die Admin-API.
        </p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
      >
        <select
          aria-label="Listenart"
          className="h-10 rounded border border-border bg-background px-2 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as 'whitelist' | 'blacklist')}
        >
          <option value="whitelist">Whitelist</option>
          <option value="blacklist">Blacklist</option>
        </select>
        <Input
          aria-label="Eintrag"
          className="min-w-[220px] flex-1"
          placeholder="user@example.com oder example.com"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          required
        />
        <Button type="submit">
          <Plus size={16} aria-hidden="true" /> Hinzufügen
        </Button>
      </form>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {renderList('Whitelist', whitelist, 'whitelist')}
      {renderList('Blacklist', blacklist, 'blacklist')}
    </div>
  );
}
