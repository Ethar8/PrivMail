'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { ContactList } from '@/components/contacts/ContactList';
import { ContactForm } from '@/components/contacts/ContactForm';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalTrigger } from '@/components/ui/modal';
import { UnlockGate } from '@/components/ui/unlock-gate';
import { useLocalCrypto } from '@/hooks/useLocalCrypto';
import { Plus } from 'lucide-react';

interface RawContact {
  id: string;
  name_enc: string;
  email_enc: string | null;
}

export default function ContactsPage() {
  const { unlocked, unlock, encrypt, decrypt } = useLocalCrypto();
  const [contacts, setContacts] = useState<{ id: string; name: string; email: string }[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ contacts: RawContact[] }>('/contacts');
      const decrypted = await Promise.all(
        res.contacts.map(async (c) => ({
          id: c.id,
          name: await decrypt(c.name_enc).catch(() => '🔒 (falsches Passwort)'),
          email: c.email_enc ? await decrypt(c.email_enc).catch(() => '') : '',
        })),
      );
      setContacts(decrypted);
    } catch {
      setContacts([]);
    }
  }, [decrypt]);

  useEffect(() => {
    if (unlocked) void load();
  }, [unlocked, load]);

  const handleCreate = async (data: { name: string; email: string; phone: string; notes: string }) => {
    // Real client-side E2E encryption: only ciphertext leaves the browser.
    await api.post('/contacts', {
      nameEnc: await encrypt(data.name),
      emailEnc: data.email ? await encrypt(data.email) : undefined,
      phoneEnc: data.phone ? await encrypt(data.phone) : undefined,
      notesEnc: data.notes ? await encrypt(data.notes) : undefined,
    });
    setOpen(false);
    void load();
  };

  if (!unlocked) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-xl font-semibold">Kontakte</h1>
        <UnlockGate onUnlock={unlock} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kontakte</h1>
        <Modal open={open} onOpenChange={setOpen}>
          <ModalTrigger asChild>
            <Button>
              <Plus size={16} /> Kontakt
            </Button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Neuer Kontakt</ModalTitle>
            </ModalHeader>
            <ContactForm onSubmit={handleCreate} />
          </ModalContent>
        </Modal>
      </div>
      <ContactList contacts={contacts} onSelect={() => undefined} />
    </div>
  );
}
