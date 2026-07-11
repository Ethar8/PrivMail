import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailboxStore } from '../../storage/mailboxstore';
import { sanitizeMailbox } from '../../../utils/validator';

export async function handleCreate(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (!session.userId) return IMAPResponse.no(cmd.tag, 'not authenticated');
  const name = sanitizeMailbox(cmd.args[0] ?? '');
  if (!name) return IMAPResponse.bad(cmd.tag, 'CREATE requires a mailbox name');
  await mailboxStore.createMailbox(session.userId, name);
  return IMAPResponse.ok(cmd.tag, 'CREATE completed');
}
