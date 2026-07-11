'use client';

import { Input } from '@/components/ui/input';

interface Recipients {
  to: string;
  cc: string;
  bcc: string;
}

interface ComposeRecipientsProps {
  value: Recipients;
  onChange: (recipients: Recipients) => void;
}

export function ComposeRecipients({ value, onChange }: ComposeRecipientsProps) {
  const update = (field: keyof Recipients) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [field]: e.target.value });
  };

  return (
    <div className="flex flex-col gap-2">
      <Input placeholder="An" value={value.to} onChange={update('to')} />
      <Input placeholder="Cc" value={value.cc} onChange={update('cc')} />
      <Input placeholder="Bcc" value={value.bcc} onChange={update('bcc')} />
    </div>
  );
}
