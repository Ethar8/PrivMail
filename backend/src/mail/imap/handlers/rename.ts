import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailboxStore } from '../../storage/mailboxstore';
import { sanitizeMailbox } from '../../../utils/validator';

export async function handleRename(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (!session.userId) return IMAPResponse.no(cmd.tag, 'not authenticated');
  const from = sanitizeMailbox(cmd.args[0] ?? '');
  const to = sanitizeMailbox(cmd.args[1] ?? '');
  if (!from || !to) return IMAPResponse.bad(cmd.tag, 'RENAME requires old and new names');
  await mailboxStore.renameMailbox(session.userId, from, to);
  return IMAPResponse.ok(cmd.tag, 'RENAME completed');
}
