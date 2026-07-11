'use client';

import { X, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ComposeAttachmentsProps {
  files: File[];
  onChange: (files: File[]) => void;
}

export function ComposeAttachments({ files, onChange }: ComposeAttachmentsProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    onChange([...files, ...selected]);
    e.target.value = '';
  };

  const remove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <Paperclip size={16} />
        <span>Anhänge hinzufügen</span>
        <input type="file" multiple onChange={handleFileChange} className="hidden" />
      </label>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center justify-between rounded-[var(--radius)] bg-muted/50 px-3 py-1 text-sm">
              <span className="truncate">{file.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(i)} aria-label={`${file.name} entfernen`}>
                <X size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
