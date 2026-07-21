import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { query } from '../../database/connection';

export const autoresponderRouter = Router();

autoresponderRouter.use(requireAuth);

autoresponderRouter.get('/', async (req: AuthedRequest, res) => {
  const { rows } = await query(
    `SELECT * FROM autoresponders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [req.userId!],
  );
  res.json({ autoresponder: rows[0] ?? null });
});

autoresponderRouter.post('/', async (req: AuthedRequest, res) => {
  const schema = z.object({
    subject: z.string().min(1).max(998),
    body: z.string().min(1),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    isActive: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  await query(`DELETE FROM autoresponders WHERE user_id = $1`, [req.userId!]);

  const { rows } = await query(
    `INSERT INTO autoresponders (user_id, subject, body, start_at, end_at, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.userId!, parsed.data.subject, parsed.data.body,
     parsed.data.startAt ?? null, parsed.data.endAt ?? null,
     parsed.data.isActive ?? true],
  );
  res.status(201).json({ autoresponder: rows[0] });
});

autoresponderRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await query(`DELETE FROM autoresponders WHERE id = $1 AND user_id = $2`, [req.params.id, req.userId!]);
  res.json({ ok: true });
});

export async function getAutoresponder(userId: string): Promise<{ subject: string; body: string } | null> {
  const { rows } = await query(
    `SELECT * FROM autoresponders WHERE user_id = $1 AND is_active = true`,
    [userId],
  );
  const ar = rows[0] as Record<string, unknown> | undefined;
  if (!ar) return null;
  if (ar.start_at && new Date() < new Date(ar.start_at as string)) return null;
  if (ar.end_at && new Date() > new Date(ar.end_at as string)) return null;

  const responded = (ar.responded_to as string[]) ?? [];
  return { subject: ar.subject as string, body: ar.body as string };
}
