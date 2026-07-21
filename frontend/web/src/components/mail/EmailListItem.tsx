'use client';

import { Lock, ShieldAlert, ShieldCheck, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailSummary } from '@/lib/api';

interface EmailListItemProps {
  email: EmailSummary;
  selected?: boolean;
  onClick: (email: EmailSummary) => void;
}

const threatIcons: Record<string, { icon: typeof ShieldCheck; className: string; label: string }> = {
  critical: { icon: AlertCircle, className: 'text-red-500', label: 'Phishing-Verdacht! Nicht öffnen!' },
  high: { icon: AlertTriangle, className: 'text-orange-500', label: 'Vorsicht, verdächtige E-Mail!' },
  medium: { icon: ShieldAlert, className: 'text-amber-500', label: 'Prüfen Sie diese E-Mail sorgfältig' },
  low: { icon: ShieldCheck, className: 'text-green-500', label: 'Sicher' },
};

export function EmailListItem({ email, selected, onClick }: EmailListItemProps) {
  const threat = email.threatLevel && email.threatLevel !== 'safe' ? threatIcons[email.threatLevel] : null;
  const ThreatIcon = threat?.icon;

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
        {ThreatIcon && (
          <div className="flex items-center gap-1">
            <ThreatIcon size={12} className={threat.className} />
            <span className="text-xs text-muted-foreground">{threat.label}</span>
          </div>
        )}
        <span className="truncate text-sm text-muted-foreground">{email.subject}</span>
      </div>
    </button>
  );
}
