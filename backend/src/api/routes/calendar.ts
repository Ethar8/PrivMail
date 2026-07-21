import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import {
  listEvents,
  createEvent,
  deleteEvent,
  listCalendars,
  createCalendar,
  deleteCalendar,
  listAttendees,
  updateAttendeeStatusByToken,
  buildIcsInvite,
  ensureDefaultCalendar,
} from '../../models/calendar';
import { findById } from '../../models/user';
import { outboundQueue } from '../../mail/queue';
import { query } from '../../database/connection';

export const calendarRouter = Router();

calendarRouter.get('/rsvp/:token', async (req, res) => {
  const status = String(req.query.status ?? '').toUpperCase();
  if (!['ACCEPTED', 'DECLINED', 'TENTATIVE'].includes(status)) {
    res.status(400).send('Ungültiger Status. Nutzen Sie ?status=ACCEPTED|DECLINED|TENTATIVE');
    return;
  }
  const attendee = await updateAttendeeStatusByToken(
    req.params.token,
    status as 'ACCEPTED' | 'DECLINED' | 'TENTATIVE',
  );
  if (!attendee) {
    res.status(404).send('Einladung nicht gefunden');
    return;
  }
  res.type('html').send(
    `<!DOCTYPE html><html lang="de"><body style="font-family:sans-serif;padding:2rem">
     <h1>Antwort gespeichert</h1>
     <p>Status: <strong>${status}</strong> für ${attendee.email}</p>
     </body></html>`,
  );
});

calendarRouter.use(requireAuth);

calendarRouter.get('/calendars', async (req: AuthedRequest, res) => {
  res.json({ calendars: await listCalendars(req.userId!) });
});

calendarRouter.post('/calendars', async (req: AuthedRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3b82f6'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const cal = await createCalendar(req.userId!, parsed.data.name, parsed.data.color);
  res.status(201).json({ calendar: cal });
});

calendarRouter.delete('/calendars/:id', async (req: AuthedRequest, res) => {
  await deleteCalendar(req.userId!, req.params.id);
  res.json({ ok: true });
});

calendarRouter.get('/', async (req: AuthedRequest, res) => {
  await ensureDefaultCalendar(req.userId!);
  const filter =
    typeof req.query.calendars === 'string' && req.query.calendars.length > 0
      ? req.query.calendars.split(',').filter(Boolean)
      : undefined;
  const events = await listEvents(req.userId!, filter);
  res.json({ events });
});

const eventSchema = z.object({
  titleEnc: z.string(),
  startAt: z.string(),
  endAt: z.string().optional(),
  locationEnc: z.string().optional(),
  locationPlain: z.string().max(500).optional(),
  notesEnc: z.string().optional(),
  calendarId: z.string().uuid().optional(),
  attendees: z
    .array(z.object({ email: z.string().email(), displayName: z.string().optional() }))
    .optional(),
  inviteTitle: z.string().optional(),
  inviteDescription: z.string().optional(),
});

calendarRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const event = await createEvent(req.userId!, parsed.data);
  const user = await findById(req.userId!);

  if (parsed.data.attendees?.length && user) {
    const attendees = await listAttendees(event.id);
    const start = new Date(event.start_at);
    const end = event.end_at ? new Date(event.end_at) : new Date(start.getTime() + 3600000);
    for (const a of attendees) {
      const ics = buildIcsInvite({
        uid: event.ics_uid ?? event.id,
        title: parsed.data.inviteTitle ?? 'Termin',
        description: parsed.data.inviteDescription,
        location: parsed.data.locationPlain,
        startAt: start,
        endAt: end,
        organizerEmail: user.email,
        attendeeEmail: a.email,
        method: 'REQUEST',
      });
      const rsvpUrl = `/api/calendar/rsvp/${a.token}?status=ACCEPTED`;
      const body =
        `Sie wurden zu einem Termin eingeladen.\n\n` +
        `Zusagen: ${rsvpUrl}\n` +
        `Absagen: /api/calendar/rsvp/${a.token}?status=DECLINED\n` +
        `Vielleicht: /api/calendar/rsvp/${a.token}?status=TENTATIVE\n\n` +
        `Der .ics-Anhang ist im Rohformat unten beigefügt.\n\n` +
        ics;
      const raw = [
        `From: ${user.email}`,
        `To: ${a.email}`,
        `Subject: Einladung: ${parsed.data.inviteTitle ?? 'Termin'}`,
        `Content-Type: text/calendar; method=REQUEST; charset=UTF-8`,
        `Date: ${new Date().toUTCString()}`,
        '',
        body,
      ].join('\r\n');
      await outboundQueue.enqueue(user.email, [a.email], raw);
    }
  }

  res.status(201).json({ event, attendees: await listAttendees(event.id) });
});

calendarRouter.get('/:id/attendees', async (req: AuthedRequest, res) => {
  const { rows } = await query(
    `SELECT id FROM calendar_events WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId!],
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Termin nicht gefunden' });
    return;
  }
  res.json({ attendees: await listAttendees(req.params.id) });
});

calendarRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await deleteEvent(req.userId!, req.params.id);
  res.json({ ok: true });
});
