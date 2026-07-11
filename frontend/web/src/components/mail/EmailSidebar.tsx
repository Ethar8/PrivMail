'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Mailbox {
  name: string;
  total: number;
  unseen: number;
}

interface EmailSidebarProps {
  mailboxes: Mailbox[];
}

export function EmailSidebar({ mailboxes }: EmailSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-[220px] flex-col border-r border-border bg-muted/20 p-3">
      <h3 className="mb-3 px-2 text-xs font-semibold uppercase text-muted-foreground">Ordner</h3>
      <nav className="flex flex-col gap-0.5">
        {mailboxes.map((mb) => {
          const href = `/dashboard/inbox?mailbox=${encodeURIComponent(mb.name)}`;
          const active = pathname === '/dashboard/inbox';
          return (
            <Link
              key={mb.name}
              href={href}
              className={cn(
                'flex items-center justify-between rounded-[var(--radius)] px-3 py-1.5 text-sm transition-colors',
                active && 'bg-muted font-medium',
                !active && 'hover:bg-muted',
              )}
            >
              <span>{mb.name}</span>
              <div className="flex items-center gap-1.5">
                {mb.unseen > 0 && (
                  <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                    {mb.unseen}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{mb.total}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
