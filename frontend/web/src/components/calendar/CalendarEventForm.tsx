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
}

interface CalendarEventFormProps {
  onSubmit: (data: CalendarEventFormData) => void;
  initial?: Partial<CalendarEventFormData>;
}

export function CalendarEventForm({ onSubmit, initial }: CalendarEventFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [startAt, setStartAt] = useState(initial?.startAt ?? '');
  const [endAt, setEndAt] = useState(initial?.endAt ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, startAt, endAt, location, notes });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Titel</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Start</label>
          <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Ende</label>
          <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Ort</label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Notizen</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <Button type="submit">Speichern</Button>
    </form>
  );
}
