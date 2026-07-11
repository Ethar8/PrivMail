'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { summarizeEmail, loadAIConfig } from '@/lib/ai';

export function AISummary({ content }: { content: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await summarizeEmail(content));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!loadAIConfig()) return null;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-muted/30 p-3">
      {!summary && !loading && (
        <Button variant="ghost" size="sm" onClick={handleSummarize}>
          <Sparkles size={14} /> KI-Zusammenfassung
        </Button>
      )}
      {loading && <p className="text-sm text-muted-foreground">Zusammenfassung wird erstellt…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {summary && (
        <div>
          <div className="mb-1 flex items-center gap-1 text-xs font-medium text-primary">
            <Sparkles size={12} /> Zusammenfassung
          </div>
          <p className="text-sm">{summary}</p>
        </div>
      )}
    </div>
  );
}
