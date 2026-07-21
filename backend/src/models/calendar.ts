import { query } from '../database/connection';
import { randomBytes, randomUUID } from 'crypto';

export interface UserCalendar {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at: Date;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  calendar_id: string | null;
  title_enc: string;
  start_at: Date;
  end_at: Date | null;
  location_enc: string | null;
  location_plain: string | null;
  notes_enc: string | null;
  attendees_json: string | null;
  ics_uid: string | null;
  created_at: Date;
}

export interface CalendarAttendee {
  id: string;
  event_id: string;
  email: string;
  display_name: string | null;
  role: string;
  status: string;
  token: string;
}

export async function listCalendars(userId: string): Promise<UserCalendar[]> {
  await ensureDefaultCalendar(userId);
  const { rows } = await query<UserCalendar>(
    `SELECT * FROM user_calendars WHERE user_id = $1 ORDER BY is_default DESC, name ASC`,
    [userId],
  );
  return rows;
}

export async function ensureDefaultCalendar(userId: string): Promise<UserCalendar> {
  const { rows } = await query<UserCalendar>(
    `SELECT * FROM user_calendars WHERE user_id = $1 AND is_default = true LIMIT 1`,
    [userId],
  );
  if (rows[0]) return rows[0];
  const { rows: created } = await query<UserCalendar>(
    `INSERT INTO user_calendars (user_id, name, color, is_default)
     VALUES ($1, 'Privat', '#3b82f6', true) RETURNING *`,
    [userId],
  );
  return created[0];
}

export async function createCalendar(
  userId: string,
  name: string,
  color: string,
): Promise<UserCalendar> {
  const { rows } = await query<UserCalendar>(
    `INSERT INTO user_calendars (user_id, name, color, is_default)
     VALUES ($1, $2, $3, false) RETURNING *`,
    [userId, name, color],
  );
  return rows[0];
}

export async function deleteCalendar(userId: string, id: string): Promise<void> {
  await query(`DELETE FROM user_calendars WHERE id = $1 AND user_id = $2 AND is_default = false`, [
    id,
    userId,
  ]);
}

export async function listEvents(userId: string, calendarIds?: string[]): Promise<CalendarEvent[]> {
  if (calendarIds && calendarIds.length > 0) {
    const { rows } = await query<CalendarEvent>(
      `SELECT * FROM calendar_events
       WHERE user_id = $1 AND (calendar_id = ANY($2::uuid[]) OR calendar_id IS NULL)
       ORDER BY start_at ASC`,
      [userId, calendarIds],
    );
    return rows;
  }
  const { rows } = await query<CalendarEvent>(
    `SELECT * FROM calendar_events WHERE user_id = $1 ORDER BY start_at ASC`,
    [userId],
  );
  return rows;
}

export async function createEvent(
  userId: string,
  data: {
    titleEnc: string;
    startAt: string;
    endAt?: string;
    locationEnc?: string;
    locationPlain?: string;
    notesEnc?: string;
    calendarId?: string;
    attendees?: { email: string; displayName?: string }[];
  },
): Promise<CalendarEvent> {
  const def = await ensureDefaultCalendar(userId);
  const calendarId = data.calendarId ?? def.id;
  const icsUid = `${randomUUID()}@privmail`;
  const { rows } = await query<CalendarEvent>(
    `INSERT INTO calendar_events
       (user_id, calendar_id, title_enc, start_at, end_at, location_enc, location_plain, notes_enc, attendees_json, ics_uid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      userId,
      calendarId,
      data.titleEnc,
      data.startAt,
      data.endAt ?? null,
      data.locationEnc ?? null,
      data.locationPlain ?? null,
      data.notesEnc ?? null,
      data.attendees ? JSON.stringify(data.attendees) : null,
      icsUid,
    ],
  );
  const event = rows[0];
  if (data.attendees?.length) {
    for (const a of data.attendees) {
      const token = randomBytes(24).toString('hex');
      await query(
        `INSERT INTO calendar_attendees (event_id, email, display_name, token)
         VALUES ($1, $2, $3, $4) ON CONFLICT (event_id, email) DO NOTHING`,
        [event.id, a.email.toLowerCase(), a.displayName ?? null, token],
      );
    }
  }
  return event;
}

export async function deleteEvent(userId: string, id: string): Promise<void> {
  await query(`DELETE FROM calendar_events WHERE id = $1 AND user_id = $2`, [id, userId]);
}

export async function listAttendees(eventId: string): Promise<CalendarAttendee[]> {
  const { rows } = await query<CalendarAttendee>(
    `SELECT * FROM calendar_attendees WHERE event_id = $1`,
    [eventId],
  );
  return rows;
}

export async function updateAttendeeStatusByToken(
  token: string,
  status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE',
): Promise<CalendarAttendee | null> {
  const { rows } = await query<CalendarAttendee>(
    `UPDATE calendar_attendees SET status = $2 WHERE token = $1 RETURNING *`,
    [token, status],
  );
  return rows[0] ?? null;
}

export function buildIcsInvite(opts: {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt: Date;
  organizerEmail: string;
  attendeeEmail: string;
  method: 'REQUEST' | 'REPLY';
  partStat?: string;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PrivMail//EN',
    `METHOD:${opts.method}`,
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.startAt)}`,
    `DTEND:${fmt(opts.endAt)}`,
    `SUMMARY:${escapeIcs(opts.title)}`,
    opts.description ? `DESCRIPTION:${escapeIcs(opts.description)}` : '',
    opts.location ? `LOCATION:${escapeIcs(opts.location)}` : '',
    `ORGANIZER:mailto:${opts.organizerEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=${opts.partStat ?? 'NEEDS-ACTION'};RSVP=TRUE:mailto:${opts.attendeeEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
