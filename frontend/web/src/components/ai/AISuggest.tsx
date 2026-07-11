'use client';

import { useState } from 'react';
import { Sparkles, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { suggestReply } from '@/lib/ai';

interface AISuggestProps {
  content: string;
  onSuggestion: (text: string) => void;
}

export function AISuggest({ content, onSuggestion }: AISuggestProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuggest = async () => {
    setLoading(true);
    setError(null);
    try {
      const suggestion = await suggestReply(content);
      onSuggestion(suggestion);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" size="sm" onClick={handleSuggest} disabled={loading}>
        <Sparkles size={14} /> {loading ? 'Generiert…' : 'Antwort vorschlagen'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
