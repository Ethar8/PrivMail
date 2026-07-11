import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { listContacts, createContact, deleteContact } from '../../models/contact';

export const contactsRouter = Router();

contactsRouter.use(requireAuth);

contactsRouter.get('/', async (req: AuthedRequest, res) => {
  res.json({ contacts: await listContacts(req.userId!) });
});

const contactSchema = z.object({
  nameEnc: z.string(),
  emailEnc: z.string().optional(),
  phoneEnc: z.string().optional(),
  notesEnc: z.string().optional(),
});

contactsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const contact = await createContact(req.userId!, parsed.data);
  res.status(201).json({ contact });
});

contactsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await deleteContact(req.userId!, req.params.id);
  res.json({ ok: true });
});
