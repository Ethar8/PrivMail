'use client';

import { useMemo } from 'react';
import { CalendarDay } from './CalendarDay';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface CalendarEventData {
  id: string;
  title: string;
  startAt: string;
}

interface CalendarMonthProps {
  events?: CalendarEventData[];
}

export function CalendarMonth({ events = [] }: CalendarMonthProps) {
  const { days, monthLabel } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return {
      days: cells,
      monthLabel: now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
    };
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEventData[]>();
    for (const ev of events) {
      const day = new Date(ev.startAt).getDate();
      const existing = map.get(day) ?? [];
      existing.push(ev);
      map.set(day, existing);
    }
    return map;
  }, [events]);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold capitalize">{monthLabel}</h2>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => (
          <CalendarDay key={i} day={day} events={day !== null ? (eventsByDay.get(day) ?? []) : []} />
        ))}
      </div>
    </div>
  );
}
