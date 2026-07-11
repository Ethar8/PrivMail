'use client';

import { useMemo, useState } from 'react';
import { CalendarMonth } from './CalendarMonth';
import { CalendarWeek } from './CalendarWeek';

interface CalendarEventData {
  id: string;
  title: string;
  startAt: string;
}

interface CalendarViewProps {
  events?: CalendarEventData[];
}

export function CalendarView({ events = [] }: CalendarViewProps) {
  const [view, setView] = useState<'month' | 'week'>('month');

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setView('month')}
          className={`rounded-[var(--radius)] px-3 py-1 text-sm transition-colors ${
            view === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          }`}
        >
          Monat
        </button>
        <button
          onClick={() => setView('week')}
          className={`rounded-[var(--radius)] px-3 py-1 text-sm transition-colors ${
            view === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          }`}
        >
          Woche
        </button>
      </div>
      {view === 'month' ? <CalendarMonth events={events} /> : <CalendarWeek events={events} />}
    </div>
  );
}
