import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  /** Nur die quadratische Bildmarke ohne Schriftzug anzeigen. */
  markOnly?: boolean;
  /** Kantenlänge der Bildmarke in Pixeln. */
  size?: number;
  className?: string;
  /** Textgröße des Schriftzugs (Tailwind-Klasse). */
  textClassName?: string;
}

export function Logo({ markOnly = false, size = 32, className, textClassName }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src="/logo-mark.png"
        alt="PrivMail"
        width={size}
        height={size}
        priority
        className="rounded-lg"
      />
      {!markOnly && (
        <span className={cn('font-semibold', textClassName ?? 'text-lg')}>PrivMail</span>
      )}
    </span>
  );
}
