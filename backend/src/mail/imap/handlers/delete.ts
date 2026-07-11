import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailboxStore } from '../../storage/mailboxstore';
import { sanitizeMailbox } from '../../../utils/validator';
import { SYSTEM_MAILBOXES } from '../../../config/constants';

export async function handleDelete(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (!session.userId) return IMAPResponse.no(cmd.tag, 'not authenticated');
  const name = sanitizeMailbox(cmd.args[0] ?? '');
  if (!name) return IMAPResponse.bad(cmd.tag, 'DELETE requires a mailbox name');
  if ((SYSTEM_MAILBOXES as readonly string[]).includes(name)) {
    return IMAPResponse.no(cmd.tag, 'Cannot delete a system mailbox');
  }
  await mailboxStore.deleteMailbox(session.userId, name);
  return IMAPResponse.ok(cmd.tag, 'DELETE completed');
}
