'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface CalendarEventFormData {
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  notes: string;
  calendarId?: string;
  attendees?: string;
}

interface CalendarEventFormProps {
  onSubmit: (data: CalendarEventFormData) => void;
  initial?: Partial<CalendarEventFormData>;
  calendars?: { id: string; name: string; color: string }[];
}

export function CalendarEventForm({ onSubmit, initial, calendars }: CalendarEventFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [startAt, setStartAt] = useState(initial?.startAt ?? '');
  const [endAt, setEndAt] = useState(initial?.endAt ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [calendarId, setCalendarId] = useState(initial?.calendarId ?? calendars?.[0]?.id ?? '');
  const [attendees, setAttendees] = useState(initial?.attendees ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, startAt, endAt, location, notes, calendarId, attendees });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="ev-title">
          Titel
        </label>
        <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      {calendars && calendars.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="ev-cal">
            Kalender
          </label>
          <select
            id="ev-cal"
            className="h-10 w-full rounded border border-border bg-background px-2 text-sm"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
          >
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="ev-start">
            Start
          </label>
          <Input id="ev-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="ev-end">
            Ende
          </label>
          <Input id="ev-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="ev-loc">
          Ort
        </label>
        <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Physischer Ort (optional)" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="ev-att">
          Teilnehmer (E-Mails, kommagetrennt)
        </label>
        <Input
          id="ev-att"
          value={attendees}
          onChange={(e) => setAttendees(e.target.value)}
          placeholder="a@example.com, b@example.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="ev-notes">
          Notizen
        </label>
        <Textarea id="ev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <Button type="submit">Speichern</Button>
    </form>
  );
}
