import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { query } from '../../database/connection';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

// Store a user's PGP public key (and optionally an encrypted private key).
const keySchema = z.object({
  publicKey: z.string(),
  privateKeyEnc: z.string().optional(),
  fingerprint: z.string().optional(),
});

settingsRouter.get('/keys', async (req: AuthedRequest, res) => {
  const { rows } = await query(
    `SELECT id, public_key, fingerprint, created_at FROM pgp_keys WHERE user_id = $1`,
    [req.userId],
  );
  res.json({ keys: rows });
});

settingsRouter.post('/keys', async (req: AuthedRequest, res) => {
  const parsed = keySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const { publicKey, privateKeyEnc, fingerprint } = parsed.data;
  const { rows } = await query(
    `INSERT INTO pgp_keys (user_id, public_key, private_key_enc, fingerprint)
     VALUES ($1,$2,$3,$4) RETURNING id, public_key, fingerprint, created_at`,
    [req.userId, publicKey, privateKeyEnc ?? null, fingerprint ?? null],
  );
  res.status(201).json({ key: rows[0] });
});

settingsRouter.delete('/keys/:id', async (req: AuthedRequest, res) => {
  await query(`DELETE FROM pgp_keys WHERE id = $1 AND user_id = $2`, [req.params.id, req.userId]);
  res.json({ ok: true });
});

// WebAuthn credential listing for the security settings page.
settingsRouter.get('/credentials', async (req: AuthedRequest, res) => {
  const { rows } = await query(
    `SELECT id, credential_id, device_type, created_at FROM webauthn_credentials WHERE user_id = $1`,
    [req.userId],
  );
  res.json({ credentials: rows });
});
