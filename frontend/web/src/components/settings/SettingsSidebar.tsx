'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Shield, Lock, Sparkles, ShieldAlert, User, Upload, AtSign, Filter, CalendarOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/dashboard/settings/general', label: 'Allgemein', icon: Settings },
  { href: '/dashboard/settings/security', label: 'Sicherheit', icon: Shield },
  { href: '/dashboard/settings/encryption', label: 'Verschlüsselung', icon: Lock },
  { href: '/dashboard/settings/aliases', label: 'Aliase', icon: AtSign },
  { href: '/dashboard/settings/filters', label: 'Filter', icon: Filter },
  { href: '/dashboard/settings/autoresponder', label: 'Abwesenheit', icon: CalendarOff },
  { href: '/dashboard/settings/ai', label: 'KI', icon: Sparkles },
  { href: '/dashboard/settings/spam', label: 'Spam', icon: ShieldAlert },
  { href: '/dashboard/settings/import', label: 'Import', icon: Upload },
  { href: '/dashboard/settings/account', label: 'Konto', icon: User },
];

export function SettingsSidebar() {
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
