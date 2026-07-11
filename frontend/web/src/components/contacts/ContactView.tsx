'use client';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail, Phone, StickyNote, Pencil, Trash2 } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

interface ContactViewProps {
  contact: Contact;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
}

export function ContactView({ contact, onEdit, onDelete }: ContactViewProps) {
  const initials = contact.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold">{contact.name}</h2>
          </div>
        </div>
        <div className="flex gap-1">
          {onEdit && (
            <Button variant="ghost" size="icon" onClick={() => onEdit(contact)} aria-label="Bearbeiten">
              <Pencil size={16} />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" onClick={() => onDelete(contact)} aria-label="Löschen">
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Mail size={14} className="text-muted-foreground" />
          <span>{contact.email}</span>
        </div>
        {contact.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone size={14} className="text-muted-foreground" />
            <span>{contact.phone}</span>
          </div>
        )}
        {contact.notes && (
          <div className="flex items-start gap-2 text-sm">
            <StickyNote size={14} className="mt-0.5 text-muted-foreground" />
            <span className="whitespace-pre-wrap">{contact.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
