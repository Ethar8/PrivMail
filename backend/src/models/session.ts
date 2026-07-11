import { query } from '../database/connection';
import { randomToken } from '../utils/crypto/hash';

export interface Session {
  id: string;
  user_id: string;
  token: string;
  created_at: Date;
  expires_at: Date;
}

export async function createSession(userId: string, ttlDays = 7): Promise<Session> {
  const token = randomToken();
  const { rows } = await query<Session>(
    `INSERT INTO sessions (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' days')::interval) RETURNING *`,
    [userId, token, String(ttlDays)],
  );
  return rows[0];
}

export async function findSession(token: string): Promise<Session | null> {
  const { rows } = await query<Session>(
    `SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()`,
    [token],
  );
  return rows[0] ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
}
