'use client';

import * as React from 'react';
import { Bold, Italic, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ComposeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ComposeEditor({ value, onChange }: ComposeEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const insertAround = (before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newValue);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => insertAround('**', '**')}
          aria-label="Fett"
        >
          <Bold size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => insertAround('*', '*')}
          aria-label="Kursiv"
        >
          <Italic size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => insertAround('[', '](url)')}
          aria-label="Link"
        >
          <Link size={14} />
        </Button>
      </div>
      <Textarea
        ref={textareaRef}
        placeholder="Nachricht…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        className="min-h-[200px] resize-y"
      />
    </div>
  );
}
