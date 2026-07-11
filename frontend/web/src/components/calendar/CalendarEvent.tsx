'use client';

interface CalendarEventProps {
  event: {
    title: string;
    startAt: string;
  };
}

export function CalendarEvent({ event }: CalendarEventProps) {
  const time = new Date(event.startAt).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="mt-1 truncate rounded bg-primary/10 px-1 text-xs leading-5 text-primary">
      {time} {event.title}
    </div>
  );
}
