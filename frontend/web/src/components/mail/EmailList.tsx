'use client';

import { EmailSummary } from '@/lib/api';
import { Inbox } from 'lucide-react';
import { EmailListItem } from './EmailListItem';

interface Props {
  emails: EmailSummary[];
  selectedId?: string;
  onSelect: (email: EmailSummary) => void;
}

export function EmailList({ emails, selectedId, onSelect }: Props) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox size={32} className="mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Keine E-Mails.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {emails.map((email) => (
        <EmailListItem
          key={email.id}
          email={email}
          selected={selectedId === email.id}
          onClick={onSelect}
        />
      ))}
    </div>
  );
}
