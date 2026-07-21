import * as crypto from 'crypto';
import { query } from '../database/connection';

export interface ContactKeyRecord {
  id: string;
  userId: string;
  contactEmail: string;
  keyFingerprint: string;
  keyType: string;
  lastSeenAt: Date;
  changeCount: number;
}

export interface KeyChangeAlert {
  contactEmail: string;
  previousFingerprint: string;
  newFingerprint: string;
  changeCount: number;
  warning: string;
}

/**
 * Trusted-Key-Verifikation (Schlüsselwechsel-Warnung)
 *
 * Wenn sich der PGP-/Hybrid-Schlüssel eines bekannten Kontakts ändert,
 * wird eine deutliche Warnung ausgegeben, bevor die Nachricht normal
 * angezeigt wird ("Absender-Schlüssel hat sich geändert – möglicher
 * Man-in-the-Middle-Versuch").
 */

export async function trackContactKey(
  userId: string,
  contactEmail: string,
  fingerprint: string,
  keyType: string = 'pgp',
  publicKey?: string,
): Promise<void> {
  const existing = await getContactKey(userId, contactEmail);
  if (existing && existing.keyFingerprint === fingerprint) {
    await query(
      `UPDATE contact_keys SET last_seen_at = NOW() WHERE user_id = $1 AND contact_email = $2 AND key_fingerprint = $3`,
      [userId, contactEmail.toLowerCase(), fingerprint],
    );
    return;
  }

  const changeCount = existing ? existing.changeCount + 1 : 0;
  await query(
    `INSERT INTO contact_keys (user_id, contact_email, key_fingerprint, key_type, public_key, change_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, contact_email, key_fingerprint) DO UPDATE SET last_seen_at = NOW()`,
    [userId, contactEmail.toLowerCase(), fingerprint, keyType, publicKey ?? null, changeCount],
  );
}

export async function getContactKey(
  userId: string,
  contactEmail: string,
): Promise<ContactKeyRecord | null> {
  const { rows } = await query<ContactKeyRecord>(
    `SELECT * FROM contact_keys WHERE user_id = $1 AND contact_email = $2 ORDER BY last_seen_at DESC LIMIT 1`,
    [userId, contactEmail.toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function checkKeyChange(
  userId: string,
  contactEmail: string,
  newFingerprint: string,
): Promise<KeyChangeAlert | null> {
  const { rows } = await query<ContactKeyRecord & { prev_fingerprint: string }>(
    `SELECT * FROM contact_keys WHERE user_id = $1 AND contact_email = $2 AND key_fingerprint != $3 ORDER BY last_seen_at DESC LIMIT 1`,
    [userId, contactEmail.toLowerCase(), newFingerprint],
  );
  const previous = rows[0];
  if (!previous || previous.changeCount === 0) return null;

  return {
    contactEmail,
    previousFingerprint: previous.keyFingerprint,
    newFingerprint,
    changeCount: previous.changeCount + 1,
    warning:
      'WARNUNG: Der Verschlüsselungsschlüssel dieses Kontakts hat sich geändert. ' +
      'Möglicherweise handelt es sich um einen Man-in-the-Middle-Angriff. ' +
      `Vorheriger Fingerprint: ${previous.keyFingerprint.substring(0, 16)}... ` +
      `Neuer Fingerprint: ${newFingerprint.substring(0, 16)}...`,
  };
}

export async function listContactKeys(userId: string): Promise<ContactKeyRecord[]> {
  const { rows } = await query<ContactKeyRecord>(
    `SELECT DISTINCT ON (contact_email) * FROM contact_keys WHERE user_id = $1 ORDER BY contact_email, last_seen_at DESC`,
    [userId],
  );
  return rows;
}

export function computeFingerprint(armoredKey: string): string {
  const normalized = armoredKey.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').substring(0, 40);
}
