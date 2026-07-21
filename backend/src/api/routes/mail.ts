import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { mailStore } from '../../mail/storage/mailstore';
import { mailboxStore } from '../../mail/storage/mailboxstore';
import { outboundQueue } from '../../mail/queue';
import { findById } from '../../models/user';
import { userOwnsAlias } from '../../models/alias';
import { emailSchema } from '../../utils/validator';
import { sanitizeHtml } from '../../utils/sanitizer';
import { aiSecurityChecker } from '../../ai/security-check';
import { attachmentStore } from '../../mail/storage/attachment';

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

mailRouter.get('/:id/security-check', async (req: AuthedRequest, res) => {
  const email = await mailStore.getById(req.params.id, req.userId!);
  if (!email) {
    res.status(404).json({ error: 'Email not found' });
    return;
  }
  const result = await aiSecurityChecker.checkEmail(
    email.body,
    [],
    email.from_email,
    email.subject,
  );
  res.json({ securityCheck: result });
});

mailRouter.post('/:id/read', async (req: AuthedRequest, res) => {
  await mailStore.markRead(req.params.id, req.userId!, req.body?.read !== false);
  res.json({ ok: true });
});

mailRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await mailStore.delete(req.params.id, req.userId!);
  res.json({ ok: true });
});

const attachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  data: z.string().min(1),
});

const sendSchema = z.object({
  to: z.array(emailSchema).min(1),
  subject: z.string().max(998),
  body: z.string(),
  raw: z.string().optional(),
  isEncrypted: z.boolean().optional(),
  attachments: z.array(attachmentSchema).optional(),
  /** Optional From: primary address or an active alias owned by the user */
  from: z.string().email().optional(),
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

  const { to, subject, body, raw, isEncrypted, attachments, from: fromOverride } = parsed.data;
  const sanitizedBody = sanitizeHtml(body);

  let fromAddress = user.email;
  if (fromOverride) {
    const desired = fromOverride.toLowerCase();
    if (desired === user.email.toLowerCase()) {
      fromAddress = user.email;
    } else if (await userOwnsAlias(req.userId!, desired)) {
      fromAddress = desired;
    } else {
      res.status(403).json({ error: 'From-Adresse ist kein aktiver Alias dieses Kontos' });
      return;
    }
  }

  const storedAttachments = (attachments ?? []).map((att) => {
    const bytes = Buffer.from(att.data, 'base64');
    return attachmentStore.save(att.filename, att.contentType, bytes);
  });

  const attachmentHeaders = storedAttachments.map(
    (a) => `X-PrivMail-Attachment: ${a.id}; filename="${a.filename}"; type="${a.contentType}"`,
  );

  const rfc =
    raw ??
    [
      `From: ${fromAddress}`,
      `To: ${to.join(', ')}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      ...attachmentHeaders,
      '',
      sanitizedBody,
    ].join('\r\n');

  await outboundQueue.enqueue(fromAddress, to, rfc);

  await mailStore.store({
    userId: req.userId!,
    messageId: `<${Date.now()}.${Math.random().toString(36).slice(2)}@privmail>`,
    from: fromAddress,
    to: to.join(', '),
    subject,
    body: sanitizedBody,
    raw: rfc,
    isEncrypted: isEncrypted ?? false,
    mailbox: 'Sent',
    attachmentIds: storedAttachments.map((a) => a.id),
  });

  res.status(202).json({ ok: true, queued: outboundQueue.size });
});

const snoozeSchema = z.object({
  snoozedUntil: z.string().datetime(),
});

mailRouter.post('/:id/snooze', async (req: AuthedRequest, res) => {
  const parsed = snoozeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid snooze time' });
    return;
  }
  await mailStore.move(req.params.id, req.userId!, 'Snoozed');
  await query(
    `UPDATE emails SET snoozed_until = $3 WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId!, parsed.data.snoozedUntil],
  );
  res.json({ ok: true });
});

const expireSchema = z.object({
  expireDuration: z.enum(['1h', '24h', '7d', 'never']),
});

mailRouter.post('/:id/expire', async (req: AuthedRequest, res) => {
  const parsed = expireSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid expire duration' });
    return;
  }
  const durations: Record<string, number> = { '1h': 3600000, '24h': 86400000, '7d': 604800000 };
  const ms = durations[parsed.data.expireDuration];
  const expiresAt = ms ? new Date(Date.now() + ms) : null;
  await query(
    `UPDATE emails SET expires_at = $3, expire_duration = $4 WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId!, expiresAt, parsed.data.expireDuration === 'never' ? null : parsed.data.expireDuration],
  );
  res.json({ ok: true });
});

mailRouter.post('/send-with-delay', async (req: AuthedRequest, res) => {
  const parsed = sendSchema.extend({ scheduledAt: z.string().datetime().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const user = await findById(req.userId!);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const { to, subject, body, raw, isEncrypted } = parsed.data;
  const sanitizedBody = sanitizeHtml(body);

  const rfc = raw ?? [
    `From: ${user.email}`, `To: ${to.join(', ')}`, `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`, '', sanitizedBody,
  ].join('\r\n');

  if (parsed.data.scheduledAt) {
    const scheduledTime = new Date(parsed.data.scheduledAt).getTime();
    const delay = Math.max(0, scheduledTime - Date.now());

    await mailStore.store({
      userId: req.userId!,
      messageId: `<scheduled-${Date.now()}@privmail>`,
      from: user.email, to: to.join(', '),
      subject, body: sanitizedBody, raw: rfc,
      isEncrypted: isEncrypted ?? false, mailbox: 'Scheduled',
    });

    setTimeout(async () => {
      await outboundQueue.enqueue(user.email, to, rfc);
      await query(`UPDATE emails SET mailbox = 'Sent' WHERE user_id = $1 AND subject = $2 AND mailbox = 'Scheduled'`, [req.userId!, subject]);
    }, delay);

    res.status(202).json({ ok: true, scheduledAt: parsed.data.scheduledAt });
  } else {
    await outboundQueue.enqueue(user.email, to, rfc);
    await mailStore.store({
      userId: req.userId!, messageId: `<${Date.now()}@privmail>`,
      from: user.email, to: to.join(', '), subject, body: sanitizedBody,
      raw: rfc, isEncrypted: isEncrypted ?? false, mailbox: 'Sent',
    });
    res.status(202).json({ ok: true, queued: outboundQueue.size });
  }
});

import { query } from '../../database/connection';
