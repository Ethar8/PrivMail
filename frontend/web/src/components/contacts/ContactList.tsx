'use client';

import { Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ContactItem } from './ContactItem';

interface Contact {
  id: string;
  name: string;
  email: string;
}

interface ContactListProps {
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
}

export function ContactList({ contacts, onSelect }: ContactListProps) {
  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={<Users size={32} />}
        title="Keine Kontakte"
        description="Es wurden noch keine Kontakte hinzugefügt."
      />
    );
  }

  return (
    <div className="divide-y divide-border">
      {contacts.map((contact) => (
        <ContactItem key={contact.id} contact={contact} onClick={onSelect} />
      ))}
    </div>
  );
}
