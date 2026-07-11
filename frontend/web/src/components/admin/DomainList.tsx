'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { Plus } from 'lucide-react';

interface Domain {
  id: string;
  name: string;
}

export function DomainList() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .get<{ domains: Domain[] }>('/admin/domains')
      .then((res) => setDomains(res.domains))
      .catch((err) => setError((err as Error).message));
  };

  useEffect(load, []);

  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/admin/domains', { name: name.trim() });
      setName('');
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={addDomain} className="flex gap-2">
        <Input
          placeholder="Domain hinzufügen… (z.B. example.com)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit" disabled={loading || !name.trim()}>
          <Plus size={16} /> Hinzufügen
        </Button>
      </form>
      <ul className="divide-y divide-border rounded-[var(--radius)] border border-border">
        {domains.map((d) => (
          <li key={d.id} className="flex items-center px-4 py-2 text-sm">
            {d.name}
          </li>
        ))}
      </ul>
      {domains.length === 0 && (
        <p className="text-sm text-muted-foreground">Keine Domains konfiguriert.</p>
      )}
    </div>
  );
}
