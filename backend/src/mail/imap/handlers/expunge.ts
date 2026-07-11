import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailStore } from '../../storage/mailstore';

/**
 * EXPUNGE permanently removes messages flagged \Deleted from the selected
 * mailbox and reports their sequence numbers.
 */
export async function handleExpunge(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (session.state !== 'selected' || !session.userId || !session.selectedMailbox) {
    return IMAPResponse.no(cmd.tag, 'no mailbox selected');
  }
  const emails = await mailStore.listByUser(session.userId, session.selectedMailbox);
  let out = '';
  let removed = 0;

  for (let i = emails.length - 1; i >= 0; i--) {
    if (emails[i].is_deleted) {
      await mailStore.delete(emails[i].id, session.userId);
      out += IMAPResponse.untagged(`${i + 1} EXPUNGE`);
      removed += 1;
    }
  }

  return out + IMAPResponse.ok(cmd.tag, `EXPUNGE completed (${removed} removed)`);
}
