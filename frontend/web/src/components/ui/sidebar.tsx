'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  PenSquare,
  Inbox,
  Send,
  FileEdit,
  Archive,
  ShieldAlert,
  Trash2,
  Search,
  Calendar,
  Users,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

const nav = [
  { href: '/dashboard/compose', label: 'Verfassen', icon: PenSquare, primary: true },
  { href: '/dashboard/inbox', label: 'Posteingang', icon: Inbox },
  { href: '/dashboard/sent', label: 'Gesendet', icon: Send },
  { href: '/dashboard/drafts', label: 'Entwürfe', icon: FileEdit },
  { href: '/dashboard/archive', label: 'Archiv', icon: Archive },
  { href: '/dashboard/spam', label: 'Spam', icon: ShieldAlert },
  { href: '/dashboard/trash', label: 'Papierkorb', icon: Trash2 },
  { href: '/dashboard/search', label: 'Suche', icon: Search },
  { href: '/dashboard/calendar', label: 'Kalender', icon: Calendar },
  { href: '/dashboard/contacts', label: 'Kontakte', icon: Users },
  { href: '/dashboard/settings', label: 'Einstellungen', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] flex-col border-r border-border bg-muted/30 p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <Logo />
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href.split('?')[0];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm transition-colors',
                item.primary && 'bg-primary text-primary-foreground hover:bg-primary/90',
                !item.primary && active && 'bg-muted font-medium',
                !item.primary && !active && 'hover:bg-muted',
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
