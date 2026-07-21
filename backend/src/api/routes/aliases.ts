import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { findById, findByEmail } from '../../models/user';
import {
  listAliases,
  createAlias,
  deleteAlias,
  setAliasActive,
  updateAliasLabel,
  generateRandomLocalPart,
} from '../../models/alias';

export const aliasRouter = Router();

aliasRouter.use(requireAuth);

aliasRouter.get('/', async (req: AuthedRequest, res) => {
  const aliases = await listAliases(req.userId!);
  res.json({ aliases });
});

aliasRouter.post('/', async (req: AuthedRequest, res) => {
  const schema = z.object({
    alias: z.string().email().optional(),
    label: z.string().max(200).optional(),
    /** One-click random hide-my-email alias */
    quick: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email alias' });
    return;
  }

  const user = await findById(req.userId!);
  const domain = user?.email.split('@')[1] ?? '';
  if (!domain) {
    res.status(400).json({ error: 'User has no domain' });
    return;
  }

  let aliasEmail: string;
  if (parsed.data.quick || !parsed.data.alias) {
    aliasEmail = `${generateRandomLocalPart()}@${domain}`;
  } else {
    aliasEmail = parsed.data.alias.toLowerCase();
    if (!aliasEmail.endsWith('@' + domain)) {
      res.status(400).json({ error: `Alias must end with @${domain}` });
      return;
    }
  }

  if (aliasEmail === user!.email.toLowerCase()) {
    res.status(400).json({ error: 'Alias cannot equal primary address' });
    return;
  }
  const collision = await findByEmail(aliasEmail);
  if (collision) {
    res.status(409).json({ error: 'Adresse gehört bereits einem Benutzer' });
    return;
  }

  const created = await createAlias(req.userId!, aliasEmail, parsed.data.label ?? null);
  if (!created) {
    res.status(409).json({ error: 'Alias bereits vergeben' });
    return;
  }
  res.status(201).json({ alias: created });
});

aliasRouter.patch('/:alias', async (req: AuthedRequest, res) => {
  const schema = z.object({
    label: z.string().max(200).nullable().optional(),
    isActive: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const aliasParam = decodeURIComponent(req.params.alias).toLowerCase();
  if (parsed.data.label !== undefined) {
    await updateAliasLabel(req.userId!, aliasParam, parsed.data.label);
  }
  if (parsed.data.isActive !== undefined) {
    const ok = await setAliasActive(req.userId!, aliasParam, parsed.data.isActive);
    if (!ok) {
      res.status(404).json({ error: 'Alias nicht gefunden' });
      return;
    }
  }
  const aliases = await listAliases(req.userId!);
  const alias = aliases.find((a) => a.alias_email === aliasParam);
  res.json({ alias: alias ?? null });
});

aliasRouter.delete('/:alias', async (req: AuthedRequest, res) => {
  const alias = decodeURIComponent(req.params.alias).toLowerCase();
  await deleteAlias(req.userId!, alias);
  res.json({ ok: true });
});
