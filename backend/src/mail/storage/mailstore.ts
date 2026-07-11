import { query } from '../../database/connection';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

export interface StoredEmail {
  id: string;
  message_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  raw: string;
  received_at: Date;
  is_read: boolean;
  is_encrypted: boolean;
  is_deleted: boolean;
  spam_score: number;
  mailbox: string;
  user_id: string | null;
}

export class MailStore {
  async store(params: {
    userId: string | null;
    messageId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    raw: string;
    isEncrypted?: boolean;
    spamScore?: number;
    mailbox?: string;
  }): Promise<string> {
    const id = randomUUID();
    await query(
      `INSERT INTO emails
        (id, user_id, message_id, from_email, to_email, subject, body, raw, received_at, is_read, is_encrypted, is_deleted, spam_score, mailbox)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW(), false, $9, false, $10, $11)
       ON CONFLICT (message_id) DO NOTHING`,
      [
        id,
        params.userId,
        params.messageId,
        params.from,
        params.to,
        params.subject,
        params.body,
        params.raw,
        params.isEncrypted ?? false,
        params.spamScore ?? 0,
        params.mailbox ?? 'INBOX',
      ],
    );
    logger.info(`Stored message ${params.messageId} for ${params.to}`);
    return id;
  }

  async listByUser(userId: string, mailbox = 'INBOX'): Promise<StoredEmail[]> {
    const { rows } = await query<StoredEmail>(
      `SELECT * FROM emails WHERE user_id = $1 AND mailbox = $2 ORDER BY received_at DESC LIMIT 500`,
      [userId, mailbox],
    );
    return rows;
  }

  async getById(id: string, userId: string): Promise<StoredEmail | null> {
    const { rows } = await query<StoredEmail>(`SELECT * FROM emails WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ]);
    return rows[0] ?? null;
  }

  async markRead(id: string, userId: string, read = true): Promise<void> {
    await query(`UPDATE emails SET is_read = $3 WHERE id = $1 AND user_id = $2`, [id, userId, read]);
  }

  async setFlag(
    id: string,
    userId: string,
    flag: 'deleted' | 'read',
    value: boolean,
  ): Promise<void> {
    const column = flag === 'deleted' ? 'is_deleted' : 'is_read';
    await query(`UPDATE emails SET ${column} = $3 WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
      value,
    ]);
  }

  async move(id: string, userId: string, mailbox: string): Promise<void> {
    await query(`UPDATE emails SET mailbox = $3 WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
      mailbox,
    ]);
  }

  async updateSpamScore(id: string, userId: string, score: number): Promise<void> {
    await query(`UPDATE emails SET spam_score = $3 WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
      score,
    ]);
  }

  async delete(id: string, userId: string): Promise<void> {
    await query(`DELETE FROM emails WHERE id = $1 AND user_id = $2`, [id, userId]);
  }
}

export const mailStore = new MailStore();
