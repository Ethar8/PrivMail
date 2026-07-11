import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailboxStore } from '../../storage/mailboxstore';
import { sanitizeMailbox } from '../../../utils/validator';

/**
 * STATUS <mailbox> (MESSAGES RECENT UIDNEXT UIDVALIDITY UNSEEN)
 */
export async function handleStatus(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (!session.userId) return IMAPResponse.no(cmd.tag, 'not authenticated');
  const mailbox = sanitizeMailbox(cmd.args[0] ?? 'INBOX');
  const total = await mailboxStore.countMessages(session.userId, mailbox);
  const unseen = await mailboxStore.countUnseen(session.userId, mailbox);

  const requested = cmd.raw.toUpperCase();
  const parts: string[] = [];
  if (requested.includes('MESSAGES')) parts.push(`MESSAGES ${total}`);
  if (requested.includes('RECENT')) parts.push(`RECENT 0`);
  if (requested.includes('UIDNEXT')) parts.push(`UIDNEXT ${total + 1}`);
  if (requested.includes('UIDVALIDITY')) parts.push(`UIDVALIDITY 1`);
  if (requested.includes('UNSEEN')) parts.push(`UNSEEN ${unseen}`);
  if (parts.length === 0) parts.push(`MESSAGES ${total}`, `UNSEEN ${unseen}`);

  return (
    IMAPResponse.untagged(`STATUS "${mailbox}" (${parts.join(' ')})`) +
    IMAPResponse.ok(cmd.tag, 'STATUS completed')
  );
}
