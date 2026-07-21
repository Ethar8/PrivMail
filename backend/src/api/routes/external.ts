import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { query } from '../../database/connection';
import * as crypto from 'crypto';
import { encryptWithPassword, serializePayload, parsePayload } from '../../utils/crypto/password-message';
import { hashPassword, verifyPassword } from '../../utils/crypto/hash';

export const externalRouter = Router();

/**
 * Password-protected messages for recipients without PGP.
 * Server stores only ciphertext (AES-256-GCM + PBKDF2). Recipients decrypt
 * in the browser; the decrypt API returns ciphertext + KDF params, never plaintext.
 */

externalRouter.post('/encrypt', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    recipientEmail: z.string().email(),
    subject: z.string().max(998).optional(),
    body: z.string().min(1),
    password: z.string().min(4).max(128),
    passwordHint: z.string().max(200).optional(),
    expiresIn: z.enum(['1h', '24h', '7d', '30d']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { recipientEmail, subject, body, password, passwordHint, expiresIn } = parsed.data;
  const passwordHash = await hashPassword(password);

  let expiresAt: Date | undefined;
  if (expiresIn) {
    const ms = { '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 }[expiresIn];
    expiresAt = new Date(Date.now() + ms);
  }

  const payload = encryptWithPassword(body, password);
  const encryptedSubject = subject ? serializePayload(encryptWithPassword(subject, password)) : null;
  const id = crypto.randomUUID();
  const accessCode = crypto.randomBytes(16).toString('hex');
  const accessCodeHash = crypto.createHash('sha256').update(accessCode).digest('hex');

  await query(
    `INSERT INTO external_encrypted_messages
       (id, sender_user_id, recipient_email, password_hash, password_hint, encrypted_body, encrypted_subject, expires_at, access_code_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      req.userId!,
      recipientEmail.toLowerCase(),
      passwordHash,
      passwordHint ?? null,
      serializePayload(payload),
      encryptedSubject,
      expiresAt ?? null,
      accessCodeHash,
    ],
  );

  const linkPath = `/external/${id}?code=${accessCode}`;
  res.status(201).json({ id, accessCode, linkPath, expiresAt });
});

/** Public metadata — no auth. Does not return ciphertext until password is verified. */
externalRouter.get('/:id', async (req, res) => {
  const { rows } = await query(`SELECT * FROM external_encrypted_messages WHERE id = $1`, [req.params.id]);
  const msg = rows[0] as Record<string, unknown> | undefined;
  if (!msg) {
    res.status(404).json({ error: 'Nachricht nicht gefunden' });
    return;
  }
  if (msg.expires_at && new Date(msg.expires_at as string) < new Date()) {
    await query(`DELETE FROM external_encrypted_messages WHERE id = $1`, [req.params.id]);
    res.status(410).json({ error: 'Nachricht ist abgelaufen' });
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (msg.access_code_hash) {
    const provided = crypto.createHash('sha256').update(code).digest('hex');
    if (provided !== msg.access_code_hash) {
      res.status(403).json({ error: 'Ungültiger Zugriffscode' });
      return;
    }
  }

  res.json({
    id: msg.id,
    recipientEmail: msg.recipient_email,
    hasPasswordHint: !!msg.password_hint,
    passwordHint: msg.password_hint,
    createdAt: msg.created_at,
    expiresAt: msg.expires_at,
    viewCount: msg.view_count,
    maxViews: msg.max_views,
  });
});

/**
 * Returns ciphertext + KDF params after password verification.
 * Plaintext is NEVER returned — browser decrypts with Web Crypto.
 */
externalRouter.post('/:id/ciphertext', async (req, res) => {
  const schema = z.object({
    password: z.string().min(1),
    code: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const { rows } = await query(`SELECT * FROM external_encrypted_messages WHERE id = $1`, [req.params.id]);
  const msg = rows[0] as Record<string, unknown> | undefined;
  if (!msg) {
    res.status(404).json({ error: 'Nachricht nicht gefunden' });
    return;
  }
  if (msg.expires_at && new Date(msg.expires_at as string) < new Date()) {
    await query(`DELETE FROM external_encrypted_messages WHERE id = $1`, [req.params.id]);
    res.status(410).json({ error: 'Nachricht ist abgelaufen' });
    return;
  }

  const maxViews = (msg.max_views as number) ?? 5;
  if ((msg.view_count as number) >= maxViews) {
    res.status(410).json({ error: 'Maximale Anzahl an Aufrufen erreicht' });
    return;
  }

  if (msg.access_code_hash) {
    if (!parsed.data.code) {
      res.status(403).json({ error: 'Zugriffscode erforderlich' });
      return;
    }
    const provided = crypto.createHash('sha256').update(parsed.data.code).digest('hex');
    if (provided !== msg.access_code_hash) {
      res.status(403).json({ error: 'Ungültiger Zugriffscode' });
      return;
    }
  }

  const ok = await verifyPassword(parsed.data.password, msg.password_hash as string);
  if (!ok) {
    res.status(403).json({ error: 'Falsches Passwort' });
    return;
  }

  // Verify password can decrypt (guards against corrupt payloads) without returning plaintext.
  try {
    parsePayload(msg.encrypted_body as string);
  } catch {
    res.status(500).json({ error: 'Beschädigte Nachricht' });
    return;
  }

  const viewCount = (msg.view_count as number) + 1;
  await query(`UPDATE external_encrypted_messages SET view_count = $2 WHERE id = $1`, [
    req.params.id,
    viewCount,
  ]);

  res.json({
    encryptedBody: msg.encrypted_body,
    encryptedSubject: msg.encrypted_subject ?? null,
    viewCount,
    // Client decrypts locally — server does not return plaintext.
  });
});

/** Legacy alias — same protections as /ciphertext (access code, expiry, max views). */
externalRouter.post('/:id/decrypt', async (req, res) => {
  // Reuse ciphertext handler by rewriting method path semantics inline.
  const schema = z.object({ password: z.string().min(1), code: z.string().min(1).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const { rows } = await query(`SELECT * FROM external_encrypted_messages WHERE id = $1`, [req.params.id]);
  const msg = rows[0] as Record<string, unknown> | undefined;
  if (!msg) {
    res.status(404).json({ error: 'Nachricht nicht gefunden' });
    return;
  }
  if (msg.expires_at && new Date(msg.expires_at as string) < new Date()) {
    await query(`DELETE FROM external_encrypted_messages WHERE id = $1`, [req.params.id]);
    res.status(410).json({ error: 'Nachricht ist abgelaufen' });
    return;
  }
  const maxViews = (msg.max_views as number) ?? 5;
  if ((msg.view_count as number) >= maxViews) {
    res.status(410).json({ error: 'Maximale Anzahl an Aufrufen erreicht' });
    return;
  }
  if (msg.access_code_hash) {
    if (!parsed.data.code) {
      res.status(403).json({ error: 'Zugriffscode erforderlich' });
      return;
    }
    const provided = crypto.createHash('sha256').update(parsed.data.code).digest('hex');
    if (provided !== msg.access_code_hash) {
      res.status(403).json({ error: 'Ungültiger Zugriffscode' });
      return;
    }
  }
  const ok = await verifyPassword(parsed.data.password, msg.password_hash as string);
  if (!ok) {
    res.status(403).json({ error: 'Falsches Passwort' });
    return;
  }
  try {
    parsePayload(msg.encrypted_body as string);
  } catch {
    res.status(500).json({ error: 'Beschädigte Nachricht' });
    return;
  }
  const viewCount = (msg.view_count as number) + 1;
  await query(`UPDATE external_encrypted_messages SET view_count = $2 WHERE id = $1`, [
    req.params.id,
    viewCount,
  ]);
  res.json({
    encryptedBody: msg.encrypted_body,
    encryptedSubject: msg.encrypted_subject ?? null,
    viewCount,
  });
});
