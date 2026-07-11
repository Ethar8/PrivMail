'use client';

import { useMemo } from 'react';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface CalendarEventData {
  id: string;
  title: string;
  startAt: string;
}

interface CalendarWeekProps {
  events?: CalendarEventData[];
}

export function CalendarWeek({ events = [] }: CalendarWeekProps) {
  const hours = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => i + 6),
    [],
  );

  const weekLabel = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    return `${fmt(monday)} – ${fmt(sunday)}`;
  }, []);

  const eventsByDayHour = useMemo(() => {
    const map = new Map<string, CalendarEventData[]>();
    for (const ev of events) {
      const d = new Date(ev.startAt);
      const dayOfWeek = (d.getDay() + 6) % 7;
      const hour = d.getHours();
      const key = `${dayOfWeek}-${hour}`;
      const existing = map.get(key) ?? [];
      existing.push(ev);
      map.set(key, existing);
    }
    return map;
  }, [events]);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{weekLabel}</h2>
      <div className="grid grid-cols-8 gap-px overflow-auto rounded-[var(--radius)] border border-border">
        <div />
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-muted/30 px-2 py-1 text-center text-xs font-medium">
            {d}
          </div>
        ))}
        {hours.map((hour) => (
          <>
            <div key={`t-${hour}`} className="bg-muted/30 px-2 py-1 text-right text-xs text-muted-foreground">
              {String(hour).padStart(2, '0')}:00
            </div>
            {Array.from({ length: 7 }, (_, col) => {
              const key = `${col}-${hour}`;
              const cellEvents = eventsByDayHour.get(key) ?? [];
              return (
                <div key={`c-${col}-${hour}`} className="min-h-[32px] bg-background p-0.5">
                  {cellEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="truncate rounded bg-primary/10 px-1 text-[10px] leading-4 text-primary"
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
