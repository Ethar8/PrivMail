import { Router } from 'express';
import { z } from 'zod';
import * as crypto from 'crypto';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { query } from '../../database/connection';
import { attachmentStore } from '../../mail/storage/attachment';
import { encryptWithPassword, serializePayload, parsePayload } from '../../utils/crypto/password-message';
import { hashPassword, verifyPassword } from '../../utils/crypto/hash';

export const attachmentShareRouter = Router();

/**
 * Password-protected, expiring share links for individual attachments.
 * Reuses password-message AES-GCM + PBKDF2 (same as external emails).
 */

attachmentShareRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    attachmentId: z.string().uuid().optional(),
    filename: z.string().min(1).max(255),
    contentType: z.string().min(1).max(255),
    /** Base64 file bytes — encrypted at rest with the share password */
    data: z.string().min(1),
    password: z.string().min(4).max(128),
    passwordHint: z.string().max(200).optional(),
    expiresIn: z.enum(['1h', '24h', '7d', '30d']).default('7d'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { filename, contentType, data, password, passwordHint, expiresIn } = parsed.data;
  let attachmentId = parsed.data.attachmentId;
  if (!attachmentId) {
    const saved = attachmentStore.save(filename, contentType, Buffer.from(data, 'base64'));
    attachmentId = saved.id;
  }

  const ms = { '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 }[expiresIn];
  const expiresAt = new Date(Date.now() + ms);
  const passwordHash = await hashPassword(password);
  const accessCode = crypto.randomBytes(16).toString('hex');
  const accessCodeHash = crypto.createHash('sha256').update(accessCode).digest('hex');
  const payload = encryptWithPassword(data, password);
  const id = crypto.randomUUID();

  await query(
    `INSERT INTO attachment_shares
       (id, owner_user_id, attachment_id, filename, content_type, password_hash, password_hint,
        encrypted_payload, access_code_hash, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      req.userId!,
      attachmentId,
      filename,
      contentType,
      passwordHash,
      passwordHint ?? null,
      serializePayload(payload),
      accessCodeHash,
      expiresAt,
    ],
  );

  res.status(201).json({
    id,
    accessCode,
    linkPath: `/share/attachment/${id}?code=${accessCode}`,
    expiresAt,
    viewCount: 0,
  });
});

attachmentShareRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query(
    `SELECT id, filename, content_type, expires_at, view_count, max_views, created_at, password_hint
     FROM attachment_shares WHERE owner_user_id = $1 ORDER BY created_at DESC`,
    [req.userId!],
  );
  res.json({ shares: rows });
});

/** Public metadata */
attachmentShareRouter.get('/:id', async (req, res) => {
  const { rows } = await query(`SELECT * FROM attachment_shares WHERE id = $1`, [req.params.id]);
  const share = rows[0] as Record<string, unknown> | undefined;
  if (!share) {
    res.status(404).json({ error: 'Freigabe nicht gefunden' });
    return;
  }
  if (share.expires_at && new Date(share.expires_at as string) < new Date()) {
    await query(`DELETE FROM attachment_shares WHERE id = $1`, [req.params.id]);
    attachmentStore.delete(share.attachment_id as string);
    res.status(410).json({ error: 'Freigabe abgelaufen' });
    return;
  }
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (share.access_code_hash) {
    const provided = crypto.createHash('sha256').update(code).digest('hex');
    if (provided !== share.access_code_hash) {
      res.status(403).json({ error: 'Ungültiger Zugriffscode' });
      return;
    }
  }
  res.json({
    id: share.id,
    filename: share.filename,
    contentType: share.content_type,
    hasPasswordHint: !!share.password_hint,
    passwordHint: share.password_hint,
    expiresAt: share.expires_at,
    viewCount: share.view_count,
    maxViews: share.max_views,
  });
});

/** Returns encrypted payload for browser decrypt — never plaintext file bytes */
attachmentShareRouter.post('/:id/ciphertext', async (req, res) => {
  const schema = z.object({ password: z.string().min(1), code: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const { rows } = await query(`SELECT * FROM attachment_shares WHERE id = $1`, [req.params.id]);
  const share = rows[0] as Record<string, unknown> | undefined;
  if (!share) {
    res.status(404).json({ error: 'Freigabe nicht gefunden' });
    return;
  }
  if (share.expires_at && new Date(share.expires_at as string) < new Date()) {
    await query(`DELETE FROM attachment_shares WHERE id = $1`, [req.params.id]);
    res.status(410).json({ error: 'Freigabe abgelaufen' });
    return;
  }
  if ((share.view_count as number) >= ((share.max_views as number) ?? 20)) {
    res.status(410).json({ error: 'Maximale Abrufe erreicht' });
    return;
  }
  const provided = crypto.createHash('sha256').update(parsed.data.code).digest('hex');
  if (provided !== share.access_code_hash) {
    res.status(403).json({ error: 'Ungültiger Zugriffscode' });
    return;
  }
  const ok = await verifyPassword(parsed.data.password, share.password_hash as string);
  if (!ok) {
    res.status(403).json({ error: 'Falsches Passwort' });
    return;
  }
  try {
    parsePayload(share.encrypted_payload as string);
  } catch {
    res.status(500).json({ error: 'Beschädigte Freigabe' });
    return;
  }
  const viewCount = (share.view_count as number) + 1;
  await query(`UPDATE attachment_shares SET view_count = $2 WHERE id = $1`, [req.params.id, viewCount]);
  res.json({
    encryptedPayload: share.encrypted_payload,
    filename: share.filename,
    contentType: share.content_type,
    viewCount,
  });
});
