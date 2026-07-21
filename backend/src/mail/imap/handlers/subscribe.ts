import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { sanitizeMailbox } from '../../../utils/validator';
import { query } from '../../../database/connection';

export async function handleSubscribe(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (!session.userId) return IMAPResponse.no(cmd.tag, 'not authenticated');
  const mailbox = sanitizeMailbox(cmd.args[0] ?? '');
  if (!mailbox) return IMAPResponse.bad(cmd.tag, 'SUBSCRIBE requires a mailbox name');
  await query(
    `INSERT INTO mailbox_subscriptions (user_id, mailbox) VALUES ($1, $2) ON CONFLICT (user_id, mailbox) DO NOTHING`,
    [session.userId, mailbox],
  ).catch(() => undefined);
  return IMAPResponse.ok(cmd.tag, 'SUBSCRIBE completed');
}

export async function handleUnsubscribe(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (!session.userId) return IMAPResponse.no(cmd.tag, 'not authenticated');
  const mailbox = sanitizeMailbox(cmd.args[0] ?? '');
  if (!mailbox) return IMAPResponse.bad(cmd.tag, 'UNSUBSCRIBE requires a mailbox name');
  await query(
    `DELETE FROM mailbox_subscriptions WHERE user_id = $1 AND mailbox = $2`,
    [session.userId, mailbox],
  ).catch(() => undefined);
  return IMAPResponse.ok(cmd.tag, 'UNSUBSCRIBE completed');
}

export async function handleLsub(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (!session.userId) return IMAPResponse.no(cmd.tag, 'not authenticated');
  const reference = cmd.args[0] ?? '';
  const pattern = cmd.args[1] ?? '*';
  const { rows } = await query<{ mailbox: string }>(
    `SELECT mailbox FROM mailbox_subscriptions WHERE user_id = $1 ORDER BY mailbox`,
    [session.userId],
  );
  const subscribed = rows.map((r) => r.mailbox);
  let out = '';
  for (const mbox of subscribed) {
    const fullPath = reference ? `${reference}${mbox}` : mbox;
    out += IMAPResponse.untagged(`LSUB () "." "${fullPath}"`);
  }
  return out + IMAPResponse.ok(cmd.tag, 'LSUB completed');
}
