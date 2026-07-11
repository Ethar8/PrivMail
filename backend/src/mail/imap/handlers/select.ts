import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailboxStore } from '../../storage/mailboxstore';
import { sanitizeMailbox } from '../../../utils/validator';

export async function handleSelect(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (session.state === 'not-authenticated' || !session.userId) {
    return IMAPResponse.no(cmd.tag, 'not authenticated');
  }
  const mailbox = sanitizeMailbox(cmd.args[0] ?? 'INBOX');
  const total = await mailboxStore.countMessages(session.userId, mailbox);
  const unseen = await mailboxStore.countUnseen(session.userId, mailbox);
  const uidnext = total + 1;

  session.state = 'selected';
  session.selectedMailbox = mailbox;

  return (
    IMAPResponse.untagged(`FLAGS (\\Seen \\Answered \\Flagged \\Deleted \\Draft)`) +
    IMAPResponse.untagged(`OK [PERMANENTFLAGS (\\Seen \\Deleted \\Flagged)] Limited`) +
    IMAPResponse.untagged(`${total} EXISTS`) +
    IMAPResponse.untagged(`0 RECENT`) +
    IMAPResponse.untagged(`OK [UNSEEN ${unseen}] first unseen`) +
    IMAPResponse.untagged(`OK [UIDVALIDITY 1] UIDs valid`) +
    IMAPResponse.untagged(`OK [UIDNEXT ${uidnext}] Predicted next UID`) +
    IMAPResponse.ok(cmd.tag, '[READ-WRITE] SELECT completed')
  );
}
