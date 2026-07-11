import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoaderProps {
  className?: string;
  label?: string;
  size?: number;
}

export function Loader({ className, label, size = 24 }: LoaderProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)} role="status">
      <Loader2 size={size} className="animate-spin text-muted-foreground" />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}
