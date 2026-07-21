import { query } from '../database/connection';
import { findByEmail, findById, User } from './user';
import { randomBytes } from 'crypto';

export interface EmailAlias {
  id: string;
  user_id: string;
  alias_email: string;
  label: string | null;
  is_active: boolean;
  mail_count: number;
  disabled_at: Date | null;
  created_at: Date;
}

export type LocalRecipientResult =
  | { kind: 'user'; user: User; deliveredTo: string; aliasId?: string }
  | { kind: 'disabled_alias'; aliasEmail: string }
  | { kind: 'unknown' };

/** Resolve a local RCPT address to a user (primary email or active alias). */
export async function resolveLocalRecipient(address: string): Promise<LocalRecipientResult> {
  const normalized = address.toLowerCase().trim();
  const user = await findByEmail(normalized);
  if (user) return { kind: 'user', user, deliveredTo: normalized };

  const { rows } = await query<EmailAlias>(
    `SELECT * FROM email_aliases WHERE alias_email = $1`,
    [normalized],
  );
  const alias = rows[0];
  if (!alias) return { kind: 'unknown' };
  if (!alias.is_active) return { kind: 'disabled_alias', aliasEmail: normalized };

  const owner = await findById(alias.user_id);
  if (!owner) return { kind: 'unknown' };
  return { kind: 'user', user: owner, deliveredTo: normalized, aliasId: alias.id };
}

export async function incrementAliasMailCount(aliasId: string): Promise<void> {
  await query(`UPDATE email_aliases SET mail_count = mail_count + 1 WHERE id = $1`, [aliasId]);
}

export async function listAliases(userId: string): Promise<EmailAlias[]> {
  const { rows } = await query<EmailAlias>(
    `SELECT * FROM email_aliases WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

export async function createAlias(
  userId: string,
  aliasEmail: string,
  label?: string | null,
): Promise<EmailAlias | null> {
  const { rows } = await query<EmailAlias>(
    `INSERT INTO email_aliases (user_id, alias_email, label)
     VALUES ($1, $2, $3)
     ON CONFLICT (alias_email) DO NOTHING
     RETURNING *`,
    [userId, aliasEmail.toLowerCase(), label ?? null],
  );
  return rows[0] ?? null;
}

export function generateRandomLocalPart(): string {
  return `hide.${randomBytes(5).toString('hex')}`;
}

export async function userOwnsAlias(userId: string, aliasEmail: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM email_aliases WHERE user_id = $1 AND alias_email = $2 AND is_active = true`,
    [userId, aliasEmail.toLowerCase()],
  );
  return rows.length > 0;
}

export async function setAliasActive(userId: string, aliasEmail: string, active: boolean): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE email_aliases
     SET is_active = $3, disabled_at = CASE WHEN $3 THEN NULL ELSE NOW() END
     WHERE user_id = $1 AND alias_email = $2`,
    [userId, aliasEmail.toLowerCase(), active],
  );
  return (rowCount ?? 0) > 0;
}

export async function updateAliasLabel(userId: string, aliasEmail: string, label: string | null): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE email_aliases SET label = $3 WHERE user_id = $1 AND alias_email = $2`,
    [userId, aliasEmail.toLowerCase(), label],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteAlias(userId: string, aliasEmail: string): Promise<void> {
  await query(`DELETE FROM email_aliases WHERE user_id = $1 AND alias_email = $2`, [
    userId,
    aliasEmail.toLowerCase(),
  ]);
}
