import { query } from '../database/connection';
import { sha256, randomToken } from '../utils/crypto/hash';

export interface ResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used: boolean;
}

/**
 * Creates a single-use, time-limited password reset token. Returns the RAW
 * token (to be sent to the user); only its hash is stored.
 */
export async function createResetToken(userId: string, ttlMinutes = 60): Promise<string> {
  const raw = randomToken(32);
  const tokenHash = sha256(raw);
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
    [userId, tokenHash, String(ttlMinutes)],
  );
  return raw;
}

/** Consumes a reset token; returns the user id if valid, otherwise null. */
export async function consumeResetToken(rawToken: string): Promise<string | null> {
  const tokenHash = sha256(rawToken);
  const { rows } = await query<ResetToken>(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = $1 AND used = false AND expires_at > NOW()`,
    [tokenHash],
  );
  const token = rows[0];
  if (!token) return null;
  await query(`UPDATE password_reset_tokens SET used = true WHERE id = $1`, [token.id]);
  return token.user_id;
}
