import { query } from '../../database/connection';
import { SYSTEM_MAILBOXES } from '../../config/constants';

export interface Mailbox {
  name: string;
  user_id: string;
}

export class MailboxStore {
  async listForUser(userId: string): Promise<string[]> {
    const { rows } = await query<{ mailbox: string }>(
      `SELECT DISTINCT mailbox FROM emails WHERE user_id = $1`,
      [userId],
    );
    const { rows: custom } = await query<{ name: string }>(
      `SELECT name FROM mailboxes WHERE user_id = $1`,
      [userId],
    ).catch(() => ({ rows: [] as { name: string }[] }));

    const names = new Set<string>(SYSTEM_MAILBOXES);
    for (const r of rows) names.add(r.mailbox);
    for (const c of custom) names.add(c.name);
    return [...names];
  }

  async createMailbox(userId: string, name: string): Promise<void> {
    await query(
      `INSERT INTO mailboxes (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING`,
      [userId, name],
    ).catch(() => undefined);
  }

  async deleteMailbox(userId: string, name: string): Promise<void> {
    await query(`DELETE FROM mailboxes WHERE user_id = $1 AND name = $2`, [userId, name]).catch(
      () => undefined,
    );
    await query(`UPDATE emails SET mailbox = 'Trash' WHERE user_id = $1 AND mailbox = $2`, [
      userId,
      name,
    ]);
  }

  async renameMailbox(userId: string, from: string, to: string): Promise<void> {
    await query(`UPDATE mailboxes SET name = $3 WHERE user_id = $1 AND name = $2`, [
      userId,
      from,
      to,
    ]).catch(() => undefined);
    await query(`UPDATE emails SET mailbox = $3 WHERE user_id = $1 AND mailbox = $2`, [
      userId,
      from,
      to,
    ]);
  }

  async countMessages(userId: string, mailbox: string): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM emails WHERE user_id = $1 AND mailbox = $2 AND is_deleted = false`,
      [userId, mailbox],
    );
    return rows[0] ? Number(rows[0].count) : 0;
  }

  async countUnseen(userId: string, mailbox: string): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM emails WHERE user_id = $1 AND mailbox = $2 AND is_read = false AND is_deleted = false`,
      [userId, mailbox],
    );
    return rows[0] ? Number(rows[0].count) : 0;
  }
}

export const mailboxStore = new MailboxStore();
