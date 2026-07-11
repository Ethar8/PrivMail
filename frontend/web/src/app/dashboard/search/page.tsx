'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearch } from '@/hooks/useSearch';
import { ShieldCheck } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const { results, loading, error, searched, search } = useSearch();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void search(query);
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-xl font-semibold">Lokale Volltextsuche</h1>
      <p className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <ShieldCheck size={14} className="text-primary" />
        Die Suche läuft ausschließlich lokal (SQLite FTS5). Der Server erhält deine Anfrage nie.
      </p>
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <Input placeholder="Suchbegriff…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" disabled={loading}>
          {loading ? 'Suche…' : 'Suchen'}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {searched && results.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">Keine Treffer.</p>
      )}
      <ul className="divide-y divide-border">
        {results.map((r) => (
          <li key={r.id} className="py-3">
            <div className="text-sm font-medium">{r.subject}</div>
            <div className="text-xs text-muted-foreground">{r.from}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
