'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Contact {
  id: string;
  name: string;
  email: string;
}

interface ContactItemProps {
  contact: Contact;
  onClick: (contact: Contact) => void;
}

export function ContactItem({ contact, onClick }: ContactItemProps) {
  const initials = contact.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={() => onClick(contact)}
      className="flex w-full items-center gap-3 rounded-[var(--radius)] px-4 py-3 text-left transition-colors hover:bg-muted"
    >
      <Avatar className="h-9 w-9">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{contact.name}</span>
        <span className="text-xs text-muted-foreground">{contact.email}</span>
      </div>
    </button>
  );
}
