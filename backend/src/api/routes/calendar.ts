import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { listEvents, createEvent, deleteEvent } from '../../models/calendar';

export const calendarRouter = Router();

calendarRouter.use(requireAuth);

calendarRouter.get('/', async (req: AuthedRequest, res) => {
  res.json({ events: await listEvents(req.userId!) });
});

const eventSchema = z.object({
  titleEnc: z.string(),
  startAt: z.string(),
  endAt: z.string().optional(),
  locationEnc: z.string().optional(),
  notesEnc: z.string().optional(),
});

calendarRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const event = await createEvent(req.userId!, parsed.data);
  res.status(201).json({ event });
});

calendarRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await deleteEvent(req.userId!, req.params.id);
  res.json({ ok: true });
});
