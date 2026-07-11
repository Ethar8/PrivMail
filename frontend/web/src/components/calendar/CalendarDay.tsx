'use client';

import { CalendarEvent } from './CalendarEvent';

interface CalendarEventData {
  id: string;
  title: string;
  startAt: string;
}

interface CalendarDayProps {
  day: number | null;
  events: CalendarEventData[];
}

export function CalendarDay({ day, events }: CalendarDayProps) {
  return (
    <div className="min-h-[80px] rounded-[var(--radius)] border border-border p-1 text-sm">
      {day !== null && <span className="text-xs text-muted-foreground">{day}</span>}
      {day !== null &&
        events.map((event) => <CalendarEvent key={event.id} event={event} />)}
    </div>
  );
}
