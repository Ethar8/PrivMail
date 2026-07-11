import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { mailStore } from '../../mail/storage/mailstore';
import { mailboxStore } from '../../mail/storage/mailboxstore';
import { outboundQueue } from '../../mail/queue';
import { findById } from '../../models/user';
import { emailSchema } from '../../utils/validator';

export const mailRouter = Router();

mailRouter.use(requireAuth);

mailRouter.get('/mailboxes', async (req: AuthedRequest, res) => {
  const names = await mailboxStore.listForUser(req.userId!);
  const boxes = await Promise.all(
    names.map(async (name) => ({
      name,
      total: await mailboxStore.countMessages(req.userId!, name),
      unseen: await mailboxStore.countUnseen(req.userId!, name),
    })),
  );
  res.json({ mailboxes: boxes });
});

mailRouter.get('/', async (req: AuthedRequest, res) => {
  const mailbox = typeof req.query.mailbox === 'string' ? req.query.mailbox : 'INBOX';
  const emails = await mailStore.listByUser(req.userId!, mailbox);
  res.json({
    emails: emails.map((e) => ({
      id: e.id,
      from: e.from_email,
      to: e.to_email,
      subject: e.subject,
      receivedAt: e.received_at,
      isRead: e.is_read,
      isEncrypted: e.is_encrypted,
      spamScore: e.spam_score,
      mailbox: e.mailbox,
    })),
  });
});

mailRouter.get('/:id', async (req: AuthedRequest, res) => {
  const email = await mailStore.getById(req.params.id, req.userId!);
  if (!email) {
    res.status(404).json({ error: 'Email not found' });
    return;
  }
  res.json({ email });
});

mailRouter.post('/:id/read', async (req: AuthedRequest, res) => {
  await mailStore.markRead(req.params.id, req.userId!, req.body?.read !== false);
  res.json({ ok: true });
});

mailRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await mailStore.delete(req.params.id, req.userId!);
  res.json({ ok: true });
});

const sendSchema = z.object({
  to: z.array(emailSchema).min(1),
  subject: z.string(),
  body: z.string(),
  raw: z.string().optional(),
  isEncrypted: z.boolean().optional(),
});

mailRouter.post('/send', async (req: AuthedRequest, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const user = await findById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const { to, subject, body, raw, isEncrypted } = parsed.data;
  const rfc =
    raw ??
    [
      `From: ${user.email}`,
      `To: ${to.join(', ')}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      '',
      body,
    ].join('\r\n');

  outboundQueue.enqueue(user.email, to, rfc);

  await mailStore.store({
    userId: req.userId!,
    messageId: `<${Date.now()}.${Math.random().toString(36).slice(2)}@privmail>`,
    from: user.email,
    to: to.join(', '),
    subject,
    body,
    raw: rfc,
    isEncrypted: isEncrypted ?? false,
    mailbox: 'Sent',
  });

  res.status(202).json({ ok: true, queued: outboundQueue.size });
});
