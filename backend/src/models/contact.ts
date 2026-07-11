import { query } from '../database/connection';

export interface Contact {
  id: string;
  user_id: string;
  name_enc: string;
  email_enc: string | null;
  phone_enc: string | null;
  notes_enc: string | null;
  created_at: Date;
}

export async function listContacts(userId: string): Promise<Contact[]> {
  const { rows } = await query<Contact>(
    `SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

export async function createContact(
  userId: string,
  data: { nameEnc: string; emailEnc?: string; phoneEnc?: string; notesEnc?: string },
): Promise<Contact> {
  const { rows } = await query<Contact>(
    `INSERT INTO contacts (user_id, name_enc, email_enc, phone_enc, notes_enc)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, data.nameEnc, data.emailEnc ?? null, data.phoneEnc ?? null, data.notesEnc ?? null],
  );
  return rows[0];
}

export async function deleteContact(userId: string, id: string): Promise<void> {
  await query(`DELETE FROM contacts WHERE id = $1 AND user_id = $2`, [id, userId]);
}
