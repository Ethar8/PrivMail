'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { CalendarView } from '@/components/calendar/CalendarView';
import { CalendarEventForm } from '@/components/calendar/CalendarEventForm';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalTrigger } from '@/components/ui/modal';
import { UnlockGate } from '@/components/ui/unlock-gate';
import { useLocalCrypto } from '@/hooks/useLocalCrypto';
import { Plus } from 'lucide-react';

interface RawEvent {
  id: string;
  title_enc: string;
  start_at: string;
}

export default function CalendarPage() {
  const { unlocked, unlock, encrypt, decrypt } = useLocalCrypto();
  const [events, setEvents] = useState<{ id: string; title: string; startAt: string }[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ events: RawEvent[] }>('/calendar');
      const decrypted = await Promise.all(
        res.events.map(async (e) => ({
          id: e.id,
          title: await decrypt(e.title_enc).catch(() => '🔒 (falsches Passwort)'),
          startAt: e.start_at,
        })),
      );
      setEvents(decrypted);
    } catch {
      setEvents([]);
    }
  }, [decrypt]);

  useEffect(() => {
    if (unlocked) void load();
  }, [unlocked, load]);

  const handleCreate = async (data: {
    title: string;
    startAt: string;
    endAt?: string;
    location?: string;
    notes?: string;
  }) => {
    // Real client-side E2E encryption: only ciphertext leaves the browser.
    await api.post('/calendar', {
      titleEnc: await encrypt(data.title),
      startAt: data.startAt,
      endAt: data.endAt,
      locationEnc: data.location ? await encrypt(data.location) : undefined,
      notesEnc: data.notes ? await encrypt(data.notes) : undefined,
    });
    setOpen(false);
    void load();
  };

  if (!unlocked) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-xl font-semibold">Kalender</h1>
        <UnlockGate onUnlock={unlock} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kalender</h1>
        <Modal open={open} onOpenChange={setOpen}>
          <ModalTrigger asChild>
            <Button>
              <Plus size={16} /> Termin
            </Button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Neuer Termin</ModalTitle>
            </ModalHeader>
            <CalendarEventForm onSubmit={handleCreate} />
          </ModalContent>
        </Modal>
      </div>
      <CalendarView events={events} />
    </div>
  );
}
