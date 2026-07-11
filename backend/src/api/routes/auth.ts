import { Router } from 'express';
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
  res.status(201).json({ user, token });
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
    res.status(201).json({ user, token });
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
  res.json({ user, token });
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
  res.json({ ok: true, token });
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
    const token = await createResetToken(user.id);
    logger.info(`Password reset token for ${user.email}: ${token}`);
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
