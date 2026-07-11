'use client';

import { cn } from '@/lib/utils';

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn('border-t border-border px-6 py-4 text-center text-xs text-muted-foreground', className)}>
      PrivMail &mdash; Open Source unter der MIT-Lizenz
    </footer>
  );
}
