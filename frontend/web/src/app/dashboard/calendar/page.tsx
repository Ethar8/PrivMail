'use client';

import { useEffect, useState, useCallback } from 'react';
import { calendarApi } from '@/lib/api';
import { CalendarView } from '@/components/calendar/CalendarView';
import { CalendarEventForm } from '@/components/calendar/CalendarEventForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalTrigger } from '@/components/ui/modal';
import { UnlockGate } from '@/components/ui/unlock-gate';
import { useLocalCrypto } from '@/hooks/useLocalCrypto';
import { Plus } from 'lucide-react';

interface RawEvent {
  id: string;
  title_enc: string;
  start_at: string;
  calendar_id?: string | null;
  location_plain?: string | null;
}

interface Cal {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
}

export default function CalendarPage() {
  const { unlocked, unlock, encrypt, decrypt } = useLocalCrypto();
  const [events, setEvents] = useState<{ id: string; title: string; startAt: string; color?: string }[]>([]);
  const [calendars, setCalendars] = useState<Cal[]>([]);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [newCalName, setNewCalName] = useState('');
  const [newCalColor, setNewCalColor] = useState('#10b981');

  const loadCals = useCallback(async () => {
    const res = await calendarApi.listCalendars();
    setCalendars(res.calendars);
    setVisible((prev) => {
      const next = { ...prev };
      for (const c of res.calendars) {
        if (next[c.id] === undefined) next[c.id] = true;
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const activeIds = Object.entries(visible)
        .filter(([, v]) => v)
        .map(([id]) => id);
      const res = await calendarApi.listEvents(activeIds.length ? activeIds : undefined);
      const colorById = Object.fromEntries(calendars.map((c) => [c.id, c.color]));
      const decrypted = await Promise.all(
        (res.events as unknown as RawEvent[]).map(async (e) => ({
          id: e.id,
          title: await decrypt(e.title_enc).catch(() => '🔒'),
          startAt: e.start_at,
          color: e.calendar_id ? colorById[e.calendar_id] : undefined,
        })),
      );
      setEvents(decrypted);
    } catch {
      setEvents([]);
    }
  }, [decrypt, visible, calendars]);

  useEffect(() => {
    if (unlocked) void loadCals();
  }, [unlocked, loadCals]);

  useEffect(() => {
    if (unlocked) void load();
  }, [unlocked, load]);

  const handleCreate = async (data: {
    title: string;
    startAt: string;
    endAt?: string;
    location?: string;
    notes?: string;
    calendarId?: string;
    attendees?: string;
  }) => {
    const attendeeEmails = (data.attendees ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

    await calendarApi.createEvent({
      titleEnc: await encrypt(data.title),
      startAt: data.startAt,
      endAt: data.endAt,
      locationEnc: data.location ? await encrypt(data.location) : undefined,
      locationPlain: data.location || undefined,
      notesEnc: data.notes ? await encrypt(data.notes) : undefined,
      calendarId: data.calendarId || calendars.find((c) => c.is_default)?.id,
      attendees: attendeeEmails.length ? attendeeEmails : undefined,
      inviteTitle: data.title,
      inviteDescription: data.notes,
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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
            <CalendarEventForm
              calendars={calendars}
              onSubmit={handleCreate}
            />
          </ModalContent>
        </Modal>
      </div>

      <div className="mb-4 flex flex-wrap gap-3" role="group" aria-label="Kalenderfilter">
        {calendars.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={visible[c.id] !== false}
              onChange={(e) => setVisible((v) => ({ ...v, [c.id]: e.target.checked }))}
            />
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: c.color }} aria-hidden="true" />
            {c.name}
          </label>
        ))}
      </div>

      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newCalName.trim()) return;
          void calendarApi.createCalendar(newCalName.trim(), newCalColor).then(() => {
            setNewCalName('');
            void loadCals();
          });
        }}
      >
        <Input
          placeholder="Neuer Kalender (z. B. Arbeit)"
          value={newCalName}
          onChange={(e) => setNewCalName(e.target.value)}
          aria-label="Kalendername"
          className="max-w-xs"
        />
        <Input
          type="color"
          value={newCalColor}
          onChange={(e) => setNewCalColor(e.target.value)}
          aria-label="Kalenderfarbe"
          className="w-14"
        />
        <Button type="submit" variant="outline" size="sm">
          Kalender anlegen
        </Button>
      </form>

      <CalendarView events={events} />
    </div>
  );
}
