'use client';

import { Lock, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailSummary } from '@/lib/api';

interface EmailListItemProps {
  email: EmailSummary;
  selected?: boolean;
  onClick: (email: EmailSummary) => void;
}

export function EmailListItem({ email, selected, onClick }: EmailListItemProps) {
  return (
    <button
      onClick={() => onClick(email)}
      className={cn(
        'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted',
        selected && 'bg-muted',
        !email.isRead && 'font-semibold',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm">{email.from}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(email.receivedAt).toLocaleDateString()}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {email.isEncrypted && <Lock size={12} className="text-primary" />}
        {email.spamScore >= 10 && <ShieldAlert size={12} className="text-amber-500" />}
        <span className="truncate text-sm text-muted-foreground">{email.subject}</span>
      </div>
    </button>
  );
}
