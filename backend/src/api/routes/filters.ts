import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { query } from '../../database/connection';

export const filterRouter = Router();

filterRouter.use(requireAuth);

filterRouter.get('/', async (req: AuthedRequest, res) => {
  const { rows } = await query(
    `SELECT * FROM mail_rules WHERE user_id = $1 ORDER BY priority ASC, created_at ASC`,
    [req.userId!],
  );
  res.json({ rules: rows });
});

filterRouter.post('/', async (req: AuthedRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    conditionField: z.enum(['from', 'to', 'subject', 'body']),
    conditionOp: z.enum(['contains', 'equals', 'starts_with', 'matches']),
    conditionValue: z.string().min(1),
    action: z.enum(['move', 'delete', 'label', 'forward']),
    actionValue: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { rows } = await query(
    `INSERT INTO mail_rules (user_id, name, condition_field, condition_op, condition_value, action, action_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.userId!, parsed.data.name, parsed.data.conditionField, parsed.data.conditionOp,
     parsed.data.conditionValue, parsed.data.action, parsed.data.actionValue ?? null],
  );
  res.status(201).json({ rule: rows[0] });
});

filterRouter.put('/:id', async (req: AuthedRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    priority: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  await query(
    `UPDATE mail_rules SET name = COALESCE($3, name), is_active = COALESCE($4, is_active), priority = COALESCE($5, priority) WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId!, parsed.data.name ?? null, parsed.data.isActive ?? null, parsed.data.priority ?? null],
  );
  res.json({ ok: true });
});

filterRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await query(`DELETE FROM mail_rules WHERE id = $1 AND user_id = $2`, [req.params.id, req.userId!]);
  res.json({ ok: true });
});

export async function applyMailRules(userId: string, email: { from: string; to: string; subject: string; body: string }): Promise<{ action: string; actionValue: string | null } | null> {
  const { rows } = await query(
    `SELECT * FROM mail_rules WHERE user_id = $1 AND is_active = true ORDER BY priority ASC`,
    [userId],
  );
  for (const rule of rows) {
    const value = email[rule.condition_field as keyof typeof email]?.toLowerCase() ?? '';
    const condValue = rule.condition_value.toLowerCase();
    let match = false;
    switch (rule.condition_op) {
      case 'contains': match = value.includes(condValue); break;
      case 'equals': match = value === condValue; break;
      case 'starts_with': match = value.startsWith(condValue); break;
      case 'matches':
        try { match = new RegExp(condValue, 'i').test(value); } catch { match = false; }
        break;
    }
    if (match) return { action: rule.action, actionValue: rule.action_value };
  }
  return null;
}
