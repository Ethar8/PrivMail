'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Globe, Server, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/admin', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Benutzer', icon: Users },
  { href: '/admin/domains', label: 'Domains', icon: Globe },
  { href: '/admin/system', label: 'System', icon: Server },
  { href: '/admin/logs', label: 'Logs', icon: FileText },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {links.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm transition-colors',
              active && 'bg-muted font-medium',
              !active && 'hover:bg-muted',
            )}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
