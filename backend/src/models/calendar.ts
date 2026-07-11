import { query } from '../database/connection';

export interface CalendarEvent {
  id: string;
  user_id: string;
  title_enc: string;
  start_at: Date;
  end_at: Date | null;
  location_enc: string | null;
  notes_enc: string | null;
  created_at: Date;
}

export async function listEvents(userId: string): Promise<CalendarEvent[]> {
  const { rows } = await query<CalendarEvent>(
    `SELECT * FROM calendar_events WHERE user_id = $1 ORDER BY start_at ASC`,
    [userId],
  );
  return rows;
}

export async function createEvent(
  userId: string,
  data: { titleEnc: string; startAt: string; endAt?: string; locationEnc?: string; notesEnc?: string },
): Promise<CalendarEvent> {
  const { rows } = await query<CalendarEvent>(
    `INSERT INTO calendar_events (user_id, title_enc, start_at, end_at, location_enc, notes_enc)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId, data.titleEnc, data.startAt, data.endAt ?? null, data.locationEnc ?? null, data.notesEnc ?? null],
  );
  return rows[0];
}

export async function deleteEvent(userId: string, id: string): Promise<void> {
  await query(`DELETE FROM calendar_events WHERE id = $1 AND user_id = $2`, [id, userId]);
}
