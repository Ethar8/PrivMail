import bcrypt from 'bcryptjs';
import { query } from '../database/connection';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  is_admin: boolean;
  token_version: number;
  created_at: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  tokenVersion: number;
}

export function toPublic(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    isAdmin: user.is_admin,
    tokenVersion: user.token_version,
  };
}

export async function createUser(
  email: string,
  password: string,
  displayName?: string,
  isAdmin = false,
): Promise<PublicUser> {
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query<User>(
    `INSERT INTO users (email, display_name, password_hash, is_admin)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [email.toLowerCase(), displayName ?? null, hash, isAdmin],
  );
  return toPublic(rows[0]);
}

export async function findByEmail(email: string): Promise<User | null> {
  const { rows } = await query<User>(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]);
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<User | null> {
  const { rows } = await query<User>(`SELECT * FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
  const user = await findByEmail(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? toPublic(user) : null;
}

export async function countUsers(): Promise<number> {
  const { rows } = await query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM users`);
  return Number(rows[0]?.count ?? 0);
}

export async function listUsers(): Promise<PublicUser[]> {
  const { rows } = await query<User>(`SELECT * FROM users ORDER BY created_at DESC`);
  return rows.map(toPublic);
}

export async function deleteUser(id: string): Promise<void> {
  await query(`DELETE FROM users WHERE id = $1`, [id]);
}

/** Returns the current token_version for a user (used for JWT revocation). */
export async function getTokenVersion(id: string): Promise<number | null> {
  const { rows } = await query<{ token_version: number }>(
    `SELECT token_version FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ? Number(rows[0].token_version) : null;
}

/** Invalidates all existing JWTs for a user by bumping token_version. */
export async function bumpTokenVersion(id: string): Promise<number> {
  const { rows } = await query<{ token_version: number }>(
    `UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version`,
    [id],
  );
  return rows[0] ? Number(rows[0].token_version) : 0;
}

/** Updates a user's password and revokes all existing sessions/tokens. */
export async function updatePassword(id: string, newPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPassword, 12);
  await query(
    `UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1`,
    [id, hash],
  );
}

/** Object-style facade matching the model naming used across the codebase. */
export const UserModel = {
  create: createUser,
  findByEmail,
  findById,
  verifyCredentials,
  count: countUsers,
  list: listUsers,
  delete: deleteUser,
  getTokenVersion,
  bumpTokenVersion,
  updatePassword,
};
