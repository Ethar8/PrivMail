'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { loadAIConfig } from '@/lib/ai';

export function AIStatus() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!!loadAIConfig());
  }, []);

  if (!enabled) return null;

  return (
    <Badge variant="secondary" className="gap-1">
      <Sparkles size={10} /> KI aktiv
    </Badge>
  );
}
