import { Router } from 'express';
import * as crypto from 'crypto';
import { z } from 'zod';
import {
  createUser,
  verifyCredentials,
  countUsers,
  findById,
  findByEmail,
  toPublic,
  updatePassword,
  bumpTokenVersion,
} from '../../models/user';
import { createResetToken, consumeResetToken } from '../../models/reset-token';
import { signToken, requireAuth, AuthedRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rate-limit';
import { emailSchema } from '../../utils/validator';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';
import { query } from '../../database/connection';
import { generateVerifier, getServerChallenge, verifyClientProof, storeSrpVerifier } from '../../utils/crypto/srp';
import { generateRecoveryPhrase, setupRecovery, resetPasswordWithRecovery, hasRecoverySetup, getRecoveryHint } from '../../utils/crypto/recovery';
import { detectAnomaly, getLoginMetadata } from '../../services/anomaly';

export const authRouter = Router();

const credsSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  displayName: z.string().optional(),
});

authRouter.get('/setup-required', async (_req, res) => {
  const count = await countUsers();
  res.json({ setupRequired: count === 0 });
});

authRouter.post('/setup', authLimiter, async (req, res) => {
  const count = await countUsers();
  if (count > 0) {
    res.status(403).json({ error: 'Setup already completed' });
    return;
  }
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const user = await createUser(parsed.data.email, parsed.data.password, parsed.data.displayName, true);
  const token = signToken({ userId: user.id, isAdmin: user.isAdmin, tv: user.tokenVersion });
  // Punkt2: JWT in httpOnly-Cookie speichern
  res.cookie('privmail-token', token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Tage Gültigkeit
  });
  res.status(201).json({ user });
});

authRouter.post('/register', authLimiter, async (req, res) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  try {
    const user = await createUser(parsed.data.email, parsed.data.password, parsed.data.displayName);
    const token = signToken({ userId: user.id, isAdmin: user.isAdmin, tv: user.tokenVersion });
    res.cookie('privmail-token', token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.status(201).json({ user });
  } catch {
    res.status(409).json({ error: 'User already exists' });
  }
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const schema = z.object({ email: emailSchema, password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = signToken({ userId: user.id, isAdmin: user.isAdmin, tv: user.tokenVersion });
  res.cookie('privmail-token', token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json({ user });
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await findById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: toPublic(user) });
});

/**
 * Logout — revokes ALL tokens for the user by bumping the token version.
 * Regel 1 (Zero-Trust): a logged-out token is immediately invalid server-side.
 */
authRouter.post('/logout', requireAuth, async (req: AuthedRequest, res) => {
  await bumpTokenVersion(req.userId!);
  res.clearCookie('privmail-token', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  });
  res.clearCookie('XSRF-TOKEN', { path: '/' });
  res.json({ ok: true });
});

/** Authenticated password change — revokes existing tokens and issues a new one. */
authRouter.post('/change-password', requireAuth, authLimiter, async (req: AuthedRequest, res) => {
  const schema = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const user = await findById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const ok = await verifyCredentials(user.email, parsed.data.currentPassword);
  if (!ok) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }
  await updatePassword(user.id, parsed.data.newPassword); // bumps token_version
  const fresh = await findById(user.id);
  const token = signToken({ userId: user.id, isAdmin: user.is_admin, tv: fresh!.token_version });
  res.cookie('privmail-token', token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json({ ok: true });
});

/**
 * Requests a password reset. Always returns 200 (no user enumeration). In a
 * self-hosted setup without outbound relay the token is logged for the admin;
 * a mail-based flow can be added later.
 */
authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const schema = z.object({ email: emailSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(200).json({ ok: true });
    return;
  }
  const user = await findByEmail(parsed.data.email);
  if (user) {
    await createResetToken(user.id);
    logger.info(`Password reset token generated for ${user.email}`);
  }
  res.status(200).json({ ok: true });
});

/** Completes a password reset with a valid single-use token. */
authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const schema = z.object({ token: z.string().min(10), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const userId = await consumeResetToken(parsed.data.token);
  if (!userId) {
    res.status(400).json({ error: 'Invalid or expired token' });
    return;
  }
  await updatePassword(userId, parsed.data.newPassword); // bumps token_version
  res.json({ ok: true });
});

authRouter.post('/srp/challenge', async (req, res) => {
  const schema = z.object({ email: emailSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(200).json({ challengeId: null, salt: null, serverPublicKey: null });
    return;
  }
  // getServerChallenge speichert b unter challengeId (nicht challengeId als b).
  const challenge = await getServerChallenge(parsed.data.email);
  if (!challenge) {
    res.status(200).json({ challengeId: null, salt: null, serverPublicKey: null });
    return;
  }
  res.json(challenge);
});

authRouter.post('/srp/verify', async (req, res) => {
  const schema = z.object({
    email: emailSchema,
    clientPublicKey: z.string(),
    clientProof: z.string(),
    challengeId: z.string().min(16),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const result = await verifyClientProof(
    parsed.data.email,
    parsed.data.clientPublicKey,
    parsed.data.clientProof,
    parsed.data.challengeId,
  );
  if (!result) {
    const meta = getLoginMetadata(req);
    meta.success = false;
    await detectAnomaly('pending', meta);
    res.status(401).json({ error: 'Authentication failed' });
    return;
  }
  const verifiedUser = await findById(result.userId);
  const token = signToken({
    userId: result.userId,
    isAdmin: verifiedUser?.is_admin ?? false,
    tv: verifiedUser?.token_version ?? 0,
  });
  res.cookie('privmail-token', token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  const meta = getLoginMetadata(req);
  const anomaly = await detectAnomaly(result.userId, meta);
  res.json({
    user: verifiedUser ? toPublic(verifiedUser) : null,
    serverProof: result.serverProof,
    anomaly: anomaly.isAnomaly ? { reasons: anomaly.reasons, confidence: anomaly.confidence } : null,
  });
});

authRouter.post('/srp/enroll', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const user = await findById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const { salt, verifier } = generateVerifier(user.email, parsed.data.password);
  await storeSrpVerifier(req.userId!, salt, verifier);
  res.json({ ok: true });
});

authRouter.post('/recovery/setup', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ hint: z.string().max(200).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const phrase = generateRecoveryPhrase(12);
  await setupRecovery(req.userId!, phrase, parsed.data.hint);
  res.json({ phrase, hint: parsed.data.hint ?? null });
});

authRouter.get('/recovery/hint', async (req, res) => {
  const email = typeof req.query.email === 'string' ? req.query.email : '';
  const user = await findByEmail(email);
  if (!user) {
    res.status(200).json({ hint: null });
    return;
  }
  const hint = await getRecoveryHint(user.id);
  res.json({ hint });
});

authRouter.post('/recovery/reset', authLimiter, async (req, res) => {
  const schema = z.object({ phrase: z.string(), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const result = await resetPasswordWithRecovery(parsed.data.phrase, parsed.data.newPassword);
  if (!result.success) {
    res.status(400).json({ error: 'Ungültige Recovery-Phrase' });
    return;
  }
  res.json({ ok: true, email: result.email });
});

authRouter.get('/anomaly/status', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query(
    `SELECT * FROM login_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
    [req.userId!],
  );
  res.json({ recent: rows });
});
