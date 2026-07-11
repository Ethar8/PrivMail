import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailStore } from '../../storage/mailstore';

/**
 * STORE <seq> <+FLAGS|-FLAGS|FLAGS> (<flags>). Applies \Seen / \Deleted state
 * to the corresponding stored message.
 */
export async function handleStore(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (session.state !== 'selected' || !session.userId || !session.selectedMailbox) {
    return IMAPResponse.no(cmd.tag, 'no mailbox selected');
  }
  const isUid = cmd.name === 'UID';
  const args = isUid ? cmd.args.slice(1) : cmd.args;
  const seq = parseInt(args[0] ?? '1', 10);
  const operation = (args[1] ?? '').toUpperCase();
  const flags = args.slice(2).join(' ').toUpperCase();

  const emails = await mailStore.listByUser(session.userId, session.selectedMailbox);
  const target = emails[seq - 1];
  if (!target) {
    return IMAPResponse.no(cmd.tag, 'message not found');
  }

  const adding = !operation.startsWith('-');
  if (flags.includes('\\SEEN')) {
    await mailStore.markRead(target.id, session.userId, adding);
  }
  if (flags.includes('\\DELETED') && adding) {
    await mailStore.setFlag(target.id, session.userId, 'deleted', true);
  }

  const newFlags = target.is_read || (adding && flags.includes('\\SEEN')) ? '\\Seen' : '';
  return (
    IMAPResponse.untagged(`${seq} FETCH (FLAGS (${newFlags}))`) +
    IMAPResponse.ok(cmd.tag, `${isUid ? 'UID ' : ''}STORE completed`)
  );
}
